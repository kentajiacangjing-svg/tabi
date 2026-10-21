// What "契約条件" means in SUMATCH, shared by the server and the forms. No database access here.
//
// SUMATCH records that both sides agreed to these terms. It is not an electronic contract and does not by
// itself satisfy the written-contract requirements for construction work (建設業法 第19条 etc.) — the
// company still issues its own contract documents. Screens must not describe the agreement as 契約締結.

import type { ContractStage, ContractTerms } from "./types";

export type TermKey = Exclude<keyof ContractTerms, "quote_id" | "quote_version" | "amount">;

export const TERM_FIELDS: { key: TermKey; label: string; hint?: string; multiline?: boolean; type?: "date" }[] = [
  { key: "scope", label: "工事範囲", hint: "どこを、どこまで工事するか", multiline: true },
  { key: "start_date", label: "工事開始予定日", type: "date" },
  { key: "duration", label: "工期", hint: "例：着工から約14日（天候により前後）" },
  { key: "materials", label: "材料・仕様", hint: "メーカー・品番・グレードなど", multiline: true },
  { key: "payment_terms", label: "支払条件", hint: "例：着工時30%・完了後70%、振込", multiline: true },
  { key: "extra_work", label: "追加工事が必要になった時", hint: "例：事前に見積を出し、お客様の承認後に着手", multiline: true },
  { key: "warranty", label: "保証", hint: "期間と対象", multiline: true },
  { key: "cancellation", label: "キャンセル条件", hint: "時期と費用の扱い", multiline: true },
];

export const STAGE_LABEL: Record<ContractStage, string> = {
  selected: "依頼先決定（契約条件はこれから）",
  terms: "契約条件の確認中",
  agreed: "双方の合意確認済み（契約書の確認待ち）",
  contracted: "契約成立（SUMATCHの要件を確認済み）",
};

/** Labels of required terms that are still empty. */
export function missingTerms(t: Partial<ContractTerms> | null | undefined): string[] {
  if (!t) return TERM_FIELDS.map((f) => f.label).concat("金額");
  const missing = TERM_FIELDS.filter((f) => !String(t[f.key] ?? "").trim()).map((f) => f.label);
  if (!t.amount || t.amount <= 0) missing.unshift("金額");
  if (t.start_date && !/^\d{4}-\d{2}-\d{2}$/.test(t.start_date)) missing.push("工事開始予定日（日付の形式）");
  return missing;
}

/** Stable text form of the terms — what a hash is taken over. Key order is fixed. */
export function canonicalTerms(t: ContractTerms): string {
  const keys: (keyof ContractTerms)[] = ["quote_id", "quote_version", "amount", ...TERM_FIELDS.map((f) => f.key)];
  return JSON.stringify(keys.map((k) => [k, typeof t[k] === "string" ? (t[k] as string).trim() : t[k]]));
}

/** SQL condition for 契約成立 — work that started under the old flow counts too. `a` is the table alias. */
export const agreedSql = (a = "") => `(${a}stage = 'contracted' OR ${a}status IN ('in_progress','completed'))`;

export const AGREEMENT_NOTE =
  "SUMATCHでの合意・確認は、条件と契約書を確認したことの記録です。SUMATCHの記録は工事請負契約書の代わりにはなりません。契約書の内容と法的な有効性は、お客様と施工会社の間で確認してください。";

/** Shown at the top of every contract screen while the legal review is not finished. */
export const TEST_OPERATION_NOTE = "テスト運用中：契約まわりの機能は法務確認中です。この画面の記録だけで契約が成立したことにはなりません。";
