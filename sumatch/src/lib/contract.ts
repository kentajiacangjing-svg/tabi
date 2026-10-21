// 依頼先決定 → 契約条件の確認 → 双方の合意確認. Server-only (database access).
//
// Rules enforced here, not in the screens:
//   • Choosing a company records 依頼先決定 only. Nothing is "agreed" until both sides agree to the same terms.
//   • Terms are written by the company; every field is required; the amount always comes from the quote.
//   • Agreeing means agreeing to a specific version (hash) of the terms. Any change — edited terms or a
//     revised quote — clears both agreements.
//   • Every step is appended to contract_events, each row hash-chained to the previous one.
//   • Until both have agreed, contact details may not be exchanged in chat, quotes or terms.
import { createHash } from "node:crypto";
import { all, get, insert, newId, now, run, update } from "./db";
import { DomainError } from "./errors";
import { notify, companyUserIds } from "./notify";
import { publish } from "./realtime";
import { CONTACT_BLOCK_MESSAGE, blockedFlags, detectContactInfo } from "./contact-detect";
import { TERM_FIELDS, canonicalTerms, missingTerms, type TermKey } from "./contract-terms";
import type { MatchContext } from "./access";
import type { Contract, ContractStage, ContractTerms, Project, Quote } from "./types";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Work that already started under the old flow counts as agreed; everything else uses the recorded stage. */
export function effectiveStage(c: Pick<Contract, "stage" | "status">): ContractStage {
  if (c.status === "in_progress" || c.status === "completed") return "agreed";
  return (c.stage as ContractStage) || "selected";
}

export function contractForMatch(matchId: string): Contract | null {
  return get<Contract>("SELECT * FROM contracts WHERE match_id = ? AND status != 'cancelled'", matchId) ?? null;
}

/** Contact details may be exchanged only after both sides agreed the terms. */
export function contactsUnlocked(matchId: string): boolean {
  const c = contractForMatch(matchId);
  return !!c && effectiveStage(c) === "agreed";
}

/**
 * Refuse text that carries contact details before the terms are agreed. The attempt is logged with the
 * kind of detail only (no text). Throws a DomainError the person can read.
 */
export function assertNoContactInfo(ctx: Pick<MatchContext, "match" | "side">, senderUserId: string | null, texts: string[], source: "message" | "quote" | "terms") {
  if (contactsUnlocked(ctx.match.id)) return;
  const flags = [...new Set(texts.flatMap((t) => blockedFlags(detectContactInfo(t ?? ""))))];
  if (!flags.length) return;
  insert("contact_blocks", {
    id: newId("cb"),
    match_id: ctx.match.id,
    sender_user_id: senderUserId,
    sender_side: ctx.side,
    flags: flags.join(","),
    source,
    created_at: now(),
  });
  throw new DomainError(CONTACT_BLOCK_MESSAGE);
}

export function termsOf(c: Pick<Contract, "terms_json">): ContractTerms | null {
  if (!c.terms_json) return null;
  try {
    return JSON.parse(c.terms_json) as ContractTerms;
  } catch {
    return null;
  }
}

export const hashTerms = (t: ContractTerms) => sha256(canonicalTerms(t));

/* ---------------- history (hash chain) ---------------- */

interface ContractEvent {
  id: string;
  contract_id: string;
  seq: number;
  actor_side: "customer" | "company" | "system";
  actor_user_id: string | null;
  action: string;
  terms_hash: string;
  detail: string;
  prev_hash: string;
  hash: string;
  created_at: string;
}

const eventHash = (e: Omit<ContractEvent, "id" | "hash">) =>
  sha256([e.prev_hash, e.contract_id, e.seq, e.actor_side, e.actor_user_id ?? "", e.action, e.terms_hash, e.detail, e.created_at].join("|"));

export function appendContractEvent(contractId: string, actorSide: ContractEvent["actor_side"], actorUserId: string | null, action: string, termsHash = "", detail = "", at = now()) {
  const last = get<ContractEvent>("SELECT * FROM contract_events WHERE contract_id = ? ORDER BY seq DESC LIMIT 1", contractId);
  const base = { contract_id: contractId, seq: (last?.seq ?? 0) + 1, actor_side: actorSide, actor_user_id: actorUserId, action, terms_hash: termsHash, detail, prev_hash: last?.hash ?? "", created_at: at };
  insert("contract_events", { id: newId("ce"), ...base, hash: eventHash(base) });
}

export function contractHistory(contractId: string): ContractEvent[] {
  return all<ContractEvent>("SELECT * FROM contract_events WHERE contract_id = ? ORDER BY seq", contractId);
}

/** True when no history row was edited, removed or reordered. */
export function verifyContractHistory(contractId: string): boolean {
  let prev = "";
  let seq = 0;
  for (const e of contractHistory(contractId)) {
    seq += 1;
    if (e.seq !== seq || e.prev_hash !== prev || eventHash(e) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

/* ---------------- quotes ---------------- */

/** The quote the company currently stands behind for this conversation (newest version, not withdrawn). */
export function latestQuoteForMatch(matchId: string): Quote | null {
  return get<Quote>("SELECT * FROM quotes WHERE match_id = ? AND status IN ('submitted','accepted') ORDER BY version DESC LIMIT 1", matchId) ?? null;
}

/* ---------------- terms & agreement ---------------- */

/** Demo data only: a contract whose terms both sides already agreed, with its history dated in the past. */
export function seedAgreedContract(c: Contract, quote: Quote, start: string, at: { selected: string; terms: string; agreed: string }, ids: { customer: string; company: string }) {
  const terms: ContractTerms = {
    quote_id: quote.id, quote_version: quote.version, amount: quote.total, scope: quote.title, start_date: start, duration: quote.duration,
    materials: quote.materials, payment_terms: quote.payment_terms, extra_work: quote.extra_costs || "事前に見積を出し、お客様の承認後に着手",
    warranty: quote.warranty, cancellation: "着工前は無償。着工後は実施済みの工事分を精算",
  };
  const hash = hashTerms(terms);
  update("contracts", c.id, {
    stage: "agreed", terms_json: JSON.stringify(terms), terms_hash: hash, start_date: start,
    customer_agreed_at: at.agreed, customer_agreed_by: ids.customer, company_agreed_at: at.terms, company_agreed_by: ids.company, agreed_at: at.agreed,
  });
  appendContractEvent(c.id, "customer", ids.customer, "selected", "", `${quote.id} v${quote.version} ${quote.total}`, at.selected);
  appendContractEvent(c.id, "company", ids.company, "terms_proposed", hash, "", at.terms);
  appendContractEvent(c.id, "company", ids.company, "agreed", hash, "", at.terms);
  appendContractEvent(c.id, "customer", ids.customer, "agreed", hash, "", at.agreed);
  appendContractEvent(c.id, "system", null, "both_agreed", hash, "", at.agreed);
}

export type TermsInput = Record<TermKey, string>;

function participants(c: Contract) {
  const project = get<Project>("SELECT * FROM projects WHERE id = ?", c.project_id)!;
  return { project, customer: [project.customer_id], company: companyUserIds(c.company_id) };
}

function systemMessage(matchId: string, body: string) {
  const ts = now();
  insert("messages", { id: newId("msg"), match_id: matchId, sender_side: "system", kind: "system", body, created_at: ts });
  run("UPDATE matches SET last_message_at = ? WHERE id = ?", ts, matchId);
}

/** The company writes (or rewrites) the terms. Both agreements are cleared. */
export function saveTerms(ctx: MatchContext, userId: string, input: TermsInput) {
  if (ctx.side !== "company") throw new DomainError("契約条件は施工会社が入力します。");
  const c = contractForMatch(ctx.match.id);
  if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
  if (effectiveStage(c) === "agreed") throw new DomainError("双方の合意が確認済みのため、条件は変更できません。");
  const quote = c.quote_id ? get<Quote>("SELECT * FROM quotes WHERE id = ?", c.quote_id) : null;
  if (!quote) throw new DomainError("見積が見つかりません。");
  const terms: ContractTerms = { quote_id: quote.id, quote_version: quote.version, amount: quote.total, ...trimTerms(input) };
  const missing = missingTerms(terms);
  if (missing.length) throw new DomainError(`未入力の項目があります：${missing.join("・")}`);
  assertNoContactInfo(ctx, userId, TERM_FIELDS.map((f) => terms[f.key]), "terms");
  const hash = hashTerms(terms);
  if (hash === c.terms_hash) return { hash, changed: false };
  const ts = now();
  update("contracts", c.id, {
    terms_json: JSON.stringify(terms),
    terms_hash: hash,
    stage: "terms",
    start_date: terms.start_date,
    customer_agreed_at: null,
    customer_agreed_by: null,
    company_agreed_at: null,
    company_agreed_by: null,
    updated_at: ts,
  });
  appendContractEvent(c.id, "company", userId, c.terms_hash ? "terms_updated" : "terms_proposed", hash);
  systemMessage(ctx.match.id, c.terms_hash ? `${ctx.company.name}が契約条件を更新しました。内容を確認してください。` : `${ctx.company.name}から契約条件が届きました。内容を確認してください。`);
  const p = participants(c);
  notify(p.customer, "contract", "契約条件が届きました", `${ctx.company.name}から契約条件が届きました。内容を確認して、問題なければ同意してください。`, `/projects/${c.project_id}`);
  publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
  return { hash, changed: true };
}

function trimTerms(input: TermsInput): TermsInput {
  return Object.fromEntries(TERM_FIELDS.map((f) => [f.key, String(input[f.key] ?? "").trim().slice(0, f.multiline ? 1000 : 200)])) as TermsInput;
}

/**
 * One side agrees to the terms they were shown (identified by hash). When both sides have agreed to the
 * same hash, the contract becomes 双方の合意確認済み. Repeating the same agreement is a no-op.
 */
export function agreeTerms(ctx: MatchContext, userId: string, shownHash: string) {
  if (ctx.side === "admin") throw new DomainError("運営は同意できません。");
  const c = contractForMatch(ctx.match.id);
  if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
  if (effectiveStage(c) === "agreed") return { agreed: true };
  const terms = termsOf(c);
  if (!terms || !c.terms_hash) throw new DomainError("契約条件がまだ届いていません。");
  if (missingTerms(terms).length) throw new DomainError("未入力の契約条件があるため、同意できません。");
  if (shownHash !== c.terms_hash) throw new DomainError("契約条件が更新されています。最新の内容を確認してから同意してください。");
  const latest = latestQuoteForMatch(ctx.match.id);
  if (!latest || latest.id !== terms.quote_id) throw new DomainError("見積が更新されています。最新の見積を確認してください。");

  const col = ctx.side === "customer" ? "customer" : "company";
  if (c[`${col}_agreed_at`]) return { agreed: false };
  const ts = now();
  const otherAgreed = !!c[`${col === "customer" ? "company" : "customer"}_agreed_at`];
  update("contracts", c.id, {
    [`${col}_agreed_at`]: ts,
    [`${col}_agreed_by`]: userId,
    ...(otherAgreed ? { stage: "agreed", agreed_at: ts, contract_date: ts.slice(0, 10) } : {}),
    updated_at: ts,
  });
  appendContractEvent(c.id, ctx.side, userId, "agreed", c.terms_hash);
  if (otherAgreed) appendContractEvent(c.id, "system", null, "both_agreed", c.terms_hash);
  const p = participants(c);
  if (otherAgreed) {
    systemMessage(ctx.match.id, "お客様と施工会社の双方が、契約条件に合意したことを確認しました。工事請負契約書は施工会社から受け取ってください。");
    notify([...p.customer, ...p.company], "contract", "双方の合意を確認しました", "契約条件への合意が両者そろいました。", `/projects/${c.project_id}`);
  } else {
    systemMessage(ctx.match.id, ctx.side === "customer" ? "お客様が契約条件に同意しました。" : `${ctx.company.name}が契約条件に同意しました。`);
    const to = ctx.side === "customer" ? p.company : p.customer;
    notify(to, "contract", "契約条件への同意がありました", "あなたの同意で、双方の合意が確認されます。", ctx.side === "customer" ? `/business/contract/${c.id}` : `/projects/${c.project_id}`);
  }
  publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
  return { agreed: otherAgreed };
}

/**
 * The chosen company revised its quote after being chosen: point the contract at the new version and make
 * both sides look again. Called inside the quote transaction.
 */
export function onQuoteRevised(c: Contract, quote: Quote, userId: string) {
  const ts = now();
  const old = termsOf(c);
  const terms = old ? { ...old, quote_id: quote.id, quote_version: quote.version, amount: quote.total } : null;
  update("contracts", c.id, {
    quote_id: quote.id,
    amount: quote.total,
    terms_json: terms ? JSON.stringify(terms) : "",
    terms_hash: terms ? hashTerms(terms) : "",
    customer_agreed_at: null,
    customer_agreed_by: null,
    company_agreed_at: null,
    company_agreed_by: null,
    updated_at: ts,
  });
  appendContractEvent(c.id, "company", userId, "quote_revised", terms ? hashTerms(terms) : "", `v${quote.version} ${quote.total}`);
}
