import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { man, pct } from "@/lib/format";
import { agreedSql } from "@/lib/contract-terms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "分析" };
export const dynamic = "force-dynamic";

export default async function BusinessAnalytics() {
  const { membership } = await requireBusiness();
  const id = membership.company.id;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const n = (sql: string, ...p: string[]) => get<{ n: number }>(sql, id, ...p)?.n ?? 0;

  // 閲覧数: times this company's card was shown to a customer (one per consultation).
  const views = n("SELECT COUNT(*) n FROM events e JOIN matches m ON m.id = e.meta WHERE e.kind = 'company_view' AND m.company_id = ? AND e.created_at >= ?", since);
  const requests = n("SELECT COUNT(*) n FROM matches WHERE company_id = ? AND customer_interest = 1 AND customer_interest_at >= ?", since);
  const matched = n("SELECT COUNT(*) n FROM matches WHERE company_id = ? AND matched_at >= ?", since);
  // Only terms both sides agreed to count as 合意 and 売上 — being chosen (依頼先決定) is not a contract.
  const won = n(`SELECT COUNT(*) n FROM contracts c JOIN matches m ON m.id = c.match_id WHERE c.company_id = ? AND ${agreedSql("c.")} AND m.matched_at >= ?`, since);
  const sales = get<{ s: number | null }>(`SELECT SUM(amount) s FROM contracts WHERE company_id = ? AND ${agreedSql()} AND created_at >= ?`, id, since)?.s ?? 0;
  const rate = (a: number, b: number) => (b ? pct(a / b) : "—");

  const pipeline = [
    ["新規相談", n("SELECT COUNT(*) n FROM matches m JOIN projects p ON p.id = m.project_id WHERE m.company_id = ? AND m.status = 'candidate' AND m.company_response = 'none' AND p.status IN ('consulting','quoting','comparing')")],
    ["進行中", n("SELECT COUNT(*) n FROM matches m JOIN projects p ON p.id = m.project_id WHERE m.company_id = ? AND m.status = 'matched' AND p.status IN ('consulting','quoting','comparing')")],
    ["見積提出済", n("SELECT COUNT(DISTINCT q.match_id) n FROM quotes q JOIN projects p ON p.id = q.project_id WHERE q.company_id = ? AND q.status = 'submitted' AND p.status IN ('consulting','quoting','comparing')")],
    ["依頼先決定", n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status IN ('contracted','in_progress')")],
  ] as const;

  const metrics = [
    ["閲覧数", views.toLocaleString(), "お客様に会社が表示された回数"],
    ["相談率", rate(requests, views), `相談の希望 ${requests}件 / 閲覧`],
    ["マッチ率", rate(matched, requests), `マッチ ${matched}件 / 相談の希望`],
    ["合意率", rate(won, matched), `双方合意 ${won}件 / マッチ`],
    ["売上", man(sales), "双方が合意した金額の合計"],
  ] as const;

  return (
    <div className="mx-auto max-w-[960px]">
      <PageHeader back={{ href: "/business/dashboard", label: "ホーム" }} title="分析" description="過去30日" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pipeline.map(([label, v]) => (
          <div key={label} className="rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="tnum text-[40px] font-semibold leading-none">{v}</div>
            <div className="mt-2 text-[14px] text-ink-2">{label}</div>
          </div>
        ))}
      </div>
      <dl className="mt-10 divide-y divide-line overflow-hidden rounded-[24px] bg-surface px-6 shadow-[var(--shadow-card)]">
        {metrics.map(([label, v, note]) => (
          <div key={label} className="flex min-h-[76px] items-center justify-between gap-4 py-3">
            <div>
              <dt className="text-[16px]">{label}</dt>
              <dd className="text-[13px] text-muted">{note}</dd>
            </div>
            <dd className="tnum text-[30px] font-semibold text-brand">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
