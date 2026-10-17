// 見積比較コメント。MVPではルールベース。
// 将来 LLM に置き換える場合も、この関数のシグネチャ（入力: 見積り配列 → 出力: 会社別コメント）を保つ。

export interface CompareQuote {
  companyId: string;
  companyName: string;
  total: number;
  warrantyYears: number;
  durationDays: number | null;
  extraCosts: string;
  itemCount: number;
  materials: string;
}

export interface CompareComment {
  companyId: string;
  tone: "good" | "info" | "caution";
  text: string;
}

export function compareQuotes(quotes: CompareQuote[]): CompareComment[] {
  if (quotes.length < 2) return [];
  const out: CompareComment[] = [];
  const totals = quotes.map((q) => q.total);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const maxWarranty = Math.max(...quotes.map((q) => q.warrantyYears));
  const durations = quotes.map((q) => q.durationDays).filter((d): d is number => d != null);
  const minDuration = durations.length ? Math.min(...durations) : null;

  for (const q of quotes) {
    if (q.total === minTotal && minTotal !== maxTotal) {
      out.push({ companyId: q.companyId, tone: "good", text: `${q.companyName}は最も金額が低い見積です。` });
      if (q.total < avg * 0.85) {
        out.push({
          companyId: q.companyId,
          tone: "caution",
          text: `平均より15%以上安いため、工事範囲や追加費用の記載を確認することをおすすめします。`,
        });
      }
    }
    if (q.warrantyYears === maxWarranty && maxWarranty > 0 && quotes.filter((x) => x.warrantyYears === maxWarranty).length === 1) {
      out.push({ companyId: q.companyId, tone: "good", text: `${q.companyName}は保証期間が最も長い（${q.warrantyYears}年）です。` });
    }
    if (minDuration != null && q.durationDays === minDuration && durations.filter((d) => d === minDuration).length === 1) {
      out.push({ companyId: q.companyId, tone: "info", text: `${q.companyName}は工期が最も短い見込みです。` });
    }
    if (!q.extraCosts.trim()) {
      out.push({ companyId: q.companyId, tone: "caution", text: `追加費用についての記載がありません。チャットで確認しておくと安心です。` });
    }
    if (q.itemCount <= 1) {
      out.push({ companyId: q.companyId, tone: "caution", text: `内訳が「一式」のみです。項目ごとの内訳を依頼すると比較しやすくなります。` });
    }
  }
  return out;
}
