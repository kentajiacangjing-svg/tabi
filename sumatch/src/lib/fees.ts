// 成功報酬の内部台帳 — 試算 (estimate) only. Rates, the base amount, billing timing, cancellation/refund and
// unpaid handling are business decisions that have not been made. Nothing here charges, invoices or contacts anyone.
//
// 仮仕様 (rule_version "draft-2"):
//   • 成果 = SUMATCH's 契約成立 (agreed terms + registered contract document confirmed by both).
//   • Base = the contract amount 税抜 (quote total − tax) by default; the operator can switch to 税込 in settings
//     (fee_base). Rate = the plan's rate when the company was chosen (contracts.success_fee_rate, editable plans).
//     Fee = base × rate, rounded by fee_rounding (floor by default). Each record keeps the rule it was made with;
//     changing a setting affects only records made afterwards.
//   • A record starts as 要確認 (pending_review). The operator moves it by hand:
//     pending_review → confirmed → invoiced → paid, or → void (対象外) from any state but paid.
import { all, get, insert, newId, now, tx, update } from "./db";
import { DomainError } from "./errors";
import { getSetting } from "./queries";
import type { Contract } from "./types";

export const FEE_RULE_VERSION = "draft-2";
export type FeeBase = "excl_tax" | "incl_tax";
export type FeeRounding = "floor" | "round" | "ceil";
export const feeBase = (): FeeBase => (getSetting("fee_base", "excl_tax") === "incl_tax" ? "incl_tax" : "excl_tax");
export const feeRounding = (): FeeRounding => {
  const r = getSetting("fee_rounding", "floor");
  return r === "round" || r === "ceil" ? r : "floor";
};
export type FeeStatus = "pending_review" | "confirmed" | "invoiced" | "paid" | "void";
export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  pending_review: "要確認（試算）",
  confirmed: "確認済み（試算・請求前）",
  invoiced: "請求済み（手動記録）",
  paid: "入金確認（手動記録）",
  void: "対象外",
};
const NEXT: Record<FeeStatus, FeeStatus[]> = {
  pending_review: ["confirmed", "void"],
  confirmed: ["invoiced", "void", "pending_review"],
  invoiced: ["paid", "void"],
  paid: [],
  void: ["pending_review"],
};
export const allowedFeeTransitions = (s: FeeStatus) => NEXT[s];

export interface FeeRecord {
  id: string;
  contract_id: string;
  company_id: string;
  base_amount: number;
  rate: number;
  fee_amount: number;
  status: FeeStatus;
  rule_version: string;
  base_kind: FeeBase;
  tax_amount: number;
  rounding: FeeRounding;
  note: string;
  created_at: string;
  updated_at: string;
}

/** Called when a contract reaches 契約成立 (inside that transaction). Idempotent: one record per contract. */
export function recordFeeForContract(c: Pick<Contract, "id" | "company_id" | "amount" | "success_fee_rate" | "quote_id">, at = now()) {
  if (get("SELECT 1 FROM fee_records WHERE contract_id = ?", c.id)) return;
  const tax = (c.quote_id ? get<{ tax: number }>("SELECT tax FROM quotes WHERE id = ?", c.quote_id)?.tax : 0) ?? 0;
  const kind = feeBase();
  const rounding = feeRounding();
  const base = kind === "excl_tax" ? c.amount - tax : c.amount;
  insert("fee_records", {
    id: newId("fee"), contract_id: c.id, company_id: c.company_id, base_amount: base, base_kind: kind, tax_amount: tax, rounding,
    rate: c.success_fee_rate, fee_amount: Math[rounding](base * c.success_fee_rate), status: "pending_review", rule_version: FEE_RULE_VERSION,
    note: "", created_at: at, updated_at: at,
  });
}

/** The operator changes a record's status by hand. Only the transitions above; every change is logged. */
export function setFeeStatus(feeId: string, to: FeeStatus, actorUserId: string, note: string) {
  return tx(() => {
    const f = get<FeeRecord>("SELECT * FROM fee_records WHERE id = ?", feeId);
    if (!f) throw new DomainError("記録が見つかりません。");
    if (!NEXT[f.status].includes(to)) throw new DomainError(`「${FEE_STATUS_LABEL[f.status]}」から「${FEE_STATUS_LABEL[to]}」には変更できません。`);
    const memo = note.trim().slice(0, 300);
    if ((to === "void" || to === "pending_review") && !memo) throw new DomainError("理由を入力してください。");
    update("fee_records", f.id, { status: to, note: memo || f.note, updated_at: now() });
    insert("fee_events", { id: newId("fev"), fee_id: f.id, from_status: f.status, to_status: to, actor_user_id: actorUserId, note: memo, created_at: now() });
  });
}

export function feeLedger() {
  return all<FeeRecord & { company: string; project: string; established_at: string | null }>(
    `SELECT f.*, co.name AS company, p.title AS project, c.established_at FROM fee_records f
       JOIN companies co ON co.id = f.company_id JOIN contracts c ON c.id = f.contract_id JOIN projects p ON p.id = c.project_id
      ORDER BY f.created_at DESC`,
  );
}

/**
 * Cases for a person to look at — signals only. None of these proves that anyone left the platform, and the
 * screen says so. Thresholds are provisional.
 */
export function reviewQueues() {
  const stalledDays = 14;
  const since = new Date(Date.now() - stalledDays * 86400_000).toISOString();
  return {
    // Work started/finished before contract documents existed: no 契約成立 record. Individual review, no auto-change.
    legacy: all<{ id: string; status: string; stage: string; amount: number; company: string; updated_at: string }>(
      `SELECT c.id, c.status, c.stage, c.amount, co.name AS company, c.updated_at FROM contracts c JOIN companies co ON co.id = c.company_id
        WHERE c.status IN ('in_progress','completed') AND c.stage != 'contracted' ORDER BY c.updated_at DESC`,
    ),
    // Chosen, but not 契約成立 for a while.
    stalled: all<{ id: string; stage: string; amount: number; company: string; updated_at: string }>(
      `SELECT c.id, c.stage, c.amount, co.name AS company, c.updated_at FROM contracts c JOIN companies co ON co.id = c.company_id
        WHERE c.status = 'contracted' AND c.stage != 'contracted' AND c.updated_at < ? ORDER BY c.updated_at`,
      since,
    ),
    // Conversations where contact details were stopped and nothing was said for a while afterwards.
    // (Timestamps are ISO strings; the "within a day" comparison is done here rather than with SQLite's datetime().)
    quietAfterBlock: all<{ match_id: string; company: string; blocks: number; last_block: string; last_message: string | null }>(
      `SELECT b.match_id, co.name AS company, COUNT(*) AS blocks, MAX(b.created_at) AS last_block, m.last_message_at AS last_message
         FROM contact_blocks b JOIN matches m ON m.id = b.match_id JOIN companies co ON co.id = m.company_id
        WHERE NOT EXISTS (SELECT 1 FROM contracts c WHERE c.match_id = m.id AND c.stage = 'contracted')
        GROUP BY b.match_id HAVING MAX(b.created_at) < ?
        ORDER BY last_block DESC`,
      since,
    ).filter((r) => !r.last_message || new Date(r.last_message).getTime() <= new Date(r.last_block).getTime() + 86400_000),
  };
}
