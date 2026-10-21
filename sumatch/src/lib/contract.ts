// 依頼先決定 → 契約条件の確認 → 双方の合意 → 契約成立. Server-only (database access).
//
// Rules enforced here, not in the screens:
//   • Choosing a company records 依頼先決定 only. Nothing is "agreed" until both sides agree to the same terms.
//   • Terms are written by the company; every field is required; the amount always comes from the quote.
//   • Agreeing means agreeing to a specific version (hash) of the terms. Any change — edited terms or a
//     revised quote — clears both agreements.
//   • 契約成立 (SUMATCH's own requirement, not a legal determination) = agreed terms + a contract document the
//     company registered + both sides confirming that exact document (by file hash). See establishmentChecks.
//   • Every step is appended to contract_events, each row hash-chained to the previous one.
//   • Contact details are never sent through chat, quotes or terms. After 契約成立 each side may share them in
//     the contract's own contact form; who viewed them is logged.
import { createHash } from "node:crypto";
import { all, get, insert, newId, now, run, tx, update } from "./db";
import { DomainError } from "./errors";
import { decryptField, encryptField } from "./field-crypto";
import { recordFeeForContract } from "./fees";
import { notify, companyUserIds } from "./notify";
import { publish } from "./realtime";
import { CONTACT_BLOCK_MESSAGE, blockedFlags, detectContactInfo, normalizeForDetection } from "./contact-detect";
import { TERM_FIELDS, canonicalTerms, missingTerms, type TermKey } from "./contract-terms";
import type { MatchContext } from "./access";
import type { Contract, ContractContact, ContractStage, ContractTerms, Project, Quote } from "./types";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * The recorded stage. Work that started under the old flow (before contract documents were checked) counts as
 * agreed, never as 契約成立 — it has no registered, confirmed document.
 */
export function effectiveStage(c: Pick<Contract, "stage" | "status">): ContractStage {
  if (c.stage === "contracted") return "contracted";
  if (c.status === "in_progress" || c.status === "completed") return "agreed";
  return (c.stage as ContractStage) || "selected";
}

/** Terms and quote are frozen once both sides agreed. */
export const termsLocked = (c: Pick<Contract, "stage" | "status">) => ["agreed", "contracted"].includes(effectiveStage(c));

export const CONTACT_USE_FORM_MESSAGE = "連絡先はチャットでは送れません。契約ページの「連絡先」欄で交換してください。";

export function contractForMatch(matchId: string): Contract | null {
  return get<Contract>("SELECT * FROM contracts WHERE match_id = ? AND status != 'cancelled'", matchId) ?? null;
}

/** The contract's contact form opens only at 契約成立. Chat never carries contact details. */
export function contactsUnlocked(matchId: string): boolean {
  const c = contractForMatch(matchId);
  return !!c && effectiveStage(c) === "contracted";
}

/**
 * Refuse text that carries contact details before the terms are agreed. The attempt is logged with the
 * kind of detail only (no text). Throws a DomainError the person can read.
 */
export function assertNoContactInfo(ctx: Pick<MatchContext, "match" | "side">, senderUserId: string | null, texts: string[], source: "message" | "quote" | "terms" | "visit") {
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
  throw new DomainError(contactsUnlocked(ctx.match.id) ? CONTACT_USE_FORM_MESSAGE : CONTACT_BLOCK_MESSAGE);
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

/**
 * Demo data only: a contract that went through every step (terms agreed, a sample document registered and
 * confirmed by both), with its history dated in the past and sample contact cards.
 */
export function seedEstablishedContract(
  c: Contract,
  quote: Quote,
  start: string,
  at: { selected: string; terms: string; agreed: string; established: string },
  ids: { customer: string; company: string },
  doc: { fileId: string; sha256: string },
  contacts: { customer: ContactInput; company: ContactInput },
) {
  const terms: ContractTerms = {
    quote_id: quote.id, quote_version: quote.version, amount: quote.total, scope: quote.title, start_date: start, duration: quote.duration,
    materials: quote.materials, payment_terms: quote.payment_terms, extra_work: quote.extra_costs || "事前に見積を出し、お客様の承認後に着手",
    warranty: quote.warranty, cancellation: "着工前は無償。着工後は実施済みの工事分を精算",
  };
  const hash = hashTerms(terms);
  update("contracts", c.id, {
    terms_json: JSON.stringify(terms), terms_hash: hash, start_date: start,
    customer_agreed_at: at.agreed, customer_agreed_by: ids.customer, company_agreed_at: at.terms, company_agreed_by: ids.company, agreed_at: at.agreed,
    stage: "contracted", contract_file_id: doc.fileId, contract_file_hash: doc.sha256, established_at: at.established, contract_date: at.established.slice(0, 10),
    customer_doc_confirmed_at: at.established, customer_doc_confirmed_by: ids.customer, company_doc_confirmed_at: at.agreed, company_doc_confirmed_by: ids.company,
  });
  appendContractEvent(c.id, "customer", ids.customer, "selected", "", `${quote.id} v${quote.version} ${quote.total}`, at.selected);
  appendContractEvent(c.id, "company", ids.company, "terms_proposed", hash, "", at.terms);
  appendContractEvent(c.id, "company", ids.company, "agreed", hash, "", at.terms);
  appendContractEvent(c.id, "customer", ids.customer, "agreed", hash, "", at.agreed);
  appendContractEvent(c.id, "system", null, "both_agreed", hash, "", at.agreed);
  appendContractEvent(c.id, "company", ids.company, "document_attached", hash, `file:${doc.fileId} sha256:${doc.sha256}`, at.agreed);
  appendContractEvent(c.id, "company", ids.company, "document_confirmed", hash, `sha256:${doc.sha256}`, at.agreed);
  appendContractEvent(c.id, "customer", ids.customer, "document_confirmed", hash, `sha256:${doc.sha256}`, at.established);
  appendContractEvent(c.id, "system", null, "contract_established", hash, `sha256:${doc.sha256}`, at.established);
  recordFeeForContract(c, at.established);
  for (const side of ["customer", "company"] as const) {
    const v = contacts[side];
    insert("contract_contacts", {
      contract_id: c.id, side, name: encryptField(v.name), phone: encryptField(v.phone), email: encryptField(v.email),
      address: encryptField(v.address), hours: encryptField(v.hours), updated_by: ids[side], updated_at: at.established,
    });
  }
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
  // Checked before the transaction so the block record is kept even though nothing is saved.
  assertNoContactInfo(ctx, userId, TERM_FIELDS.map((f) => String(input[f.key] ?? "")), "terms");
  return tx(() => saveTermsLocked(ctx, userId, input));
}

function saveTermsLocked(ctx: MatchContext, userId: string, input: TermsInput) {
  if (ctx.side !== "company") throw new DomainError("契約条件は施工会社が入力します。");
  const c = contractForMatch(ctx.match.id);
  if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
  if (termsLocked(c)) throw new DomainError("双方の合意が確認済みのため、条件は変更できません。");
  const quote = c.quote_id ? get<Quote>("SELECT * FROM quotes WHERE id = ?", c.quote_id) : null;
  if (!quote) throw new DomainError("見積が見つかりません。");
  const terms: ContractTerms = { quote_id: quote.id, quote_version: quote.version, amount: quote.total, ...trimTerms(input) };
  const missing = missingTerms(terms);
  if (missing.length) throw new DomainError(`未入力の項目があります：${missing.join("・")}`);
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
  // The full terms go into the history, so every version that was ever proposed can be read back.
  appendContractEvent(c.id, "company", userId, c.terms_hash ? "terms_updated" : "terms_proposed", hash, canonicalTerms(terms));
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
  return tx(() => {
    if (ctx.side === "admin") throw new DomainError("運営は同意できません。");
    const c = contractForMatch(ctx.match.id);
    if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
    if (termsLocked(c)) return { agreed: true };
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
      ...(otherAgreed ? { stage: "agreed", agreed_at: ts } : {}),
      updated_at: ts,
    });
    appendContractEvent(c.id, ctx.side, userId, "agreed", c.terms_hash);
    if (otherAgreed) appendContractEvent(c.id, "system", null, "both_agreed", c.terms_hash);
    const p = participants(c);
    if (otherAgreed) {
      systemMessage(ctx.match.id, "お客様と施工会社の双方が、契約条件に合意したことを確認しました。次に、施工会社が契約書を登録し、双方が内容を確認します。");
      notify(p.customer, "contract", "双方の合意を確認しました", "施工会社が契約書を登録したら、内容を確認してください。", `/projects/${c.project_id}#contract`);
      notify(p.company, "contract", "双方の合意を確認しました", "契約書（工事請負契約書）を登録してください。", `/business/contract/${c.id}`);
    } else {
      systemMessage(ctx.match.id, ctx.side === "customer" ? "お客様が契約条件に同意しました。" : `${ctx.company.name}が契約条件に同意しました。`);
      const to = ctx.side === "customer" ? p.company : p.customer;
      notify(to, "contract", "契約条件への同意がありました", "あなたの同意で、双方の合意が確認されます。", ctx.side === "customer" ? `/business/contract/${c.id}` : `/projects/${c.project_id}`);
    }
    publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
    return { agreed: otherAgreed };
  });
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

/* ---------------- 契約成立: contract document + both confirmations ---------------- */

/** What SUMATCH requires before it records 契約成立. Shown as a checklist on both sides. */
export function establishmentChecks(c: Contract) {
  const terms = termsOf(c);
  const latest = latestQuoteForMatch(c.match_id);
  return [
    { key: "terms", label: "契約条件の必須項目がすべて入力されている", ok: !!terms && missingTerms(terms).length === 0 },
    { key: "quote", label: `契約条件が最新の見積${latest ? `（第${latest.version}版）` : ""}に基づいている`, ok: !!terms && !!latest && latest.id === terms.quote_id },
    { key: "agreed", label: "お客様と施工会社が同じ契約条件に同意している", ok: !!c.customer_agreed_at && !!c.company_agreed_at && c.stage !== "terms" && c.stage !== "selected" },
    { key: "document", label: "施工会社が契約書を登録している", ok: !!c.contract_file_id && !!c.contract_file_hash },
    { key: "customer_doc", label: "お客様が契約書の内容を確認した", ok: !!c.customer_doc_confirmed_at },
    { key: "company_doc", label: "施工会社が契約書の内容を確認した", ok: !!c.company_doc_confirmed_at },
  ];
}

/** The company registers its contract document. Allowed between agreement and 契約成立; replacing it clears both confirmations. */
export function attachContractDocument(ctx: MatchContext, userId: string, file: { id: string; sha256: string }) {
  return tx(() => {
    if (ctx.side !== "company") throw new DomainError("契約書は施工会社が登録します。");
    const c = contractForMatch(ctx.match.id);
    if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
    const stage = effectiveStage(c);
    if (stage === "contracted") throw new DomainError("契約成立後は契約書を差し替えられません。変更が必要な場合は運営にご連絡ください。");
    if (stage !== "agreed") throw new DomainError("契約書は、契約条件に双方が同意してから登録できます。");
    const ts = now();
    update("contracts", c.id, {
      contract_file_id: file.id,
      contract_file_hash: file.sha256,
      customer_doc_confirmed_at: null,
      customer_doc_confirmed_by: null,
      company_doc_confirmed_at: null,
      company_doc_confirmed_by: null,
      updated_at: ts,
    });
    appendContractEvent(c.id, "company", userId, c.contract_file_id ? "document_replaced" : "document_attached", c.terms_hash, `file:${file.id} sha256:${file.sha256}`);
    systemMessage(ctx.match.id, `${ctx.company.name}が契約書を${c.contract_file_id ? "差し替え" : "登録し"}ました。内容を確認してください。`);
    const p = participants(c);
    notify(p.customer, "contract", "契約書が登録されました", "契約書の内容を確認してください。", `/projects/${c.project_id}#contract`);
    publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
  });
}

/**
 * One side confirms the contract document it was shown (identified by file hash). When both sides confirmed the
 * same document and every check passes, the contract becomes 契約成立. Repeating is a no-op.
 */
export function confirmContractDocument(ctx: MatchContext, userId: string, shownFileHash: string) {
  return tx(() => {
    if (ctx.side === "admin") throw new DomainError("運営は確認できません。");
    const c = contractForMatch(ctx.match.id);
    if (!c) throw new DomainError("この案件はまだ依頼先が決まっていません。");
    if (effectiveStage(c) === "contracted") return { established: true };
    if (effectiveStage(c) !== "agreed") throw new DomainError("契約条件に双方が同意してから確認できます。");
    if (!c.contract_file_id || !c.contract_file_hash) throw new DomainError("契約書がまだ登録されていません。");
    if (shownFileHash !== c.contract_file_hash) throw new DomainError("契約書が差し替えられています。最新の契約書を確認してください。");
    const col = ctx.side === "customer" ? "customer" : "company";
    if (c[`${col}_doc_confirmed_at`]) return { established: false };
    const ts = now();
    const confirmed: Contract = { ...c, [`${col}_doc_confirmed_at`]: ts, [`${col}_doc_confirmed_by`]: userId };
    const done = establishmentChecks(confirmed).every((x) => x.ok);
    update("contracts", c.id, {
      [`${col}_doc_confirmed_at`]: ts,
      [`${col}_doc_confirmed_by`]: userId,
      ...(done ? { stage: "contracted", established_at: ts, contract_date: ts.slice(0, 10) } : {}),
      updated_at: ts,
    });
    appendContractEvent(c.id, ctx.side, userId, "document_confirmed", c.terms_hash, `sha256:${c.contract_file_hash}`);
    const p = participants(c);
    if (done) {
      appendContractEvent(c.id, "system", null, "contract_established", c.terms_hash, `sha256:${c.contract_file_hash}`);
      recordFeeForContract(c);
      systemMessage(ctx.match.id, "契約書の確認が双方そろい、SUMATCHの契約成立の要件を満たしました。連絡先は契約ページの「連絡先」欄で交換できます。");
      notify(p.customer, "contract", "契約成立の要件を満たしました", "連絡先は契約ページの「連絡先」欄で交換できます。", `/projects/${c.project_id}#contract`);
      notify(p.company, "contract", "契約成立の要件を満たしました", "連絡先は契約ページの「連絡先」欄で交換できます。", `/business/contract/${c.id}`);
    } else {
      systemMessage(ctx.match.id, ctx.side === "customer" ? "お客様が契約書の内容を確認しました。" : `${ctx.company.name}が契約書の内容を確認しました。`);
      const to = ctx.side === "customer" ? p.company : p.customer;
      notify(to, "contract", "契約書の確認がありました", "あなたの確認で、契約成立の要件がそろいます。", ctx.side === "customer" ? `/business/contract/${c.id}` : `/projects/${c.project_id}#contract`);
    }
    publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
    return { established: done };
  });
}

/* ---------------- contact form (only after 契約成立) ---------------- */

/**
 * Provisional rule (see docs/launch-checklist.md): contacts are shown from 契約成立 until this many days after
 * the work is marked completed, then erased. A cancelled contract shows none. Either side can withdraw its own.
 */
export const CONTACT_DAYS_AFTER_COMPLETION = 90;

function contactsExpired(c: Contract) {
  if (c.status !== "completed" || !c.end_date) return false;
  return new Date(c.end_date).getTime() + CONTACT_DAYS_AFTER_COMPLETION * 86400_000 < Date.now();
}

/** Withdraw (delete) one's own contact details. The other side no longer sees them. */
export function revokeContractContact(ctx: MatchContext, userId: string) {
  const side = ctx.side;
  if (side === "admin") throw new DomainError("運営は操作できません。");
  return tx(() => {
    const c = contractForMatch(ctx.match.id);
    if (!c) throw new DomainError("契約が見つかりません。");
    const r = run("DELETE FROM contract_contacts WHERE contract_id = ? AND side = ?", c.id, side);
    if (r.changes) appendContractEvent(c.id, side, userId, "contact_revoked", c.terms_hash);
  });
}

export type ContactInput = Pick<ContractContact, "name" | "phone" | "email" | "address" | "hours">;

const PHONE_OK = /^\+?[0-9][0-9\-() ]{8,18}[0-9]$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Each side shares only what the work needs: a name, a phone number and/or email, and (customer) the site address. */
export function saveContractContact(ctx: MatchContext, userId: string, input: ContactInput) {
  return tx(() => {
    if (ctx.side === "admin") throw new DomainError("運営は登録できません。");
    const c = contractForMatch(ctx.match.id);
    if (!c || effectiveStage(c) !== "contracted") throw new DomainError("連絡先は、契約成立の要件を満たしてから交換できます。");
    const v = {
      name: normalizeForDetection(input.name ?? "").trim().slice(0, 60),
      phone: normalizeForDetection(input.phone ?? "").trim().slice(0, 30),
      email: normalizeForDetection(input.email ?? "").trim().toLowerCase().slice(0, 120),
      address: ctx.side === "customer" ? String(input.address ?? "").normalize("NFKC").trim().slice(0, 200) : "",
      hours: String(input.hours ?? "").normalize("NFKC").trim().slice(0, 100),
    };
    if (!v.name) throw new DomainError("お名前（担当者名）を入力してください。");
    if (!v.phone && !v.email) throw new DomainError("電話番号かメールアドレスのどちらかを入力してください。");
    if (v.phone && !PHONE_OK.test(v.phone)) throw new DomainError("電話番号の形式を確認してください。");
    if (v.email && !EMAIL_OK.test(v.email)) throw new DomainError("メールアドレスの形式を確認してください。");
    const ts = now();
    run(
      `INSERT INTO contract_contacts (contract_id, side, name, phone, email, address, hours, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (contract_id, side) DO UPDATE SET name = excluded.name, phone = excluded.phone, email = excluded.email, address = excluded.address,
         hours = excluded.hours, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      // Stored encrypted (field-crypto.ts): the database file and its backups never hold them in plain text.
    c.id, ctx.side, encryptField(v.name), encryptField(v.phone), encryptField(v.email), encryptField(v.address), encryptField(v.hours), userId, ts,
    );
    // The history records that contacts changed and which fields, never the values themselves.
    const filled = Object.entries(v).filter(([, x]) => x).map(([k]) => k).join(",");
    appendContractEvent(c.id, ctx.side, userId, "contact_updated", c.terms_hash, filled);
    const p = participants(c);
    const to = ctx.side === "customer" ? p.company : p.customer;
    notify(to, "contract", "連絡先が登録されました", "契約ページの「連絡先」欄で確認できます。", ctx.side === "customer" ? `/business/contract/${c.id}` : `/projects/${c.project_id}#contract`);
  });
}

/**
 * The viewer's own contact and the other side's, only after 契約成立. Reading the other side's details is
 * logged. Returns null before 契約成立 — the screen shows nothing to copy.
 */
export function contractContactsFor(c: Contract, viewer: { side: "customer" | "company"; userId: string }) {
  if (effectiveStage(c) !== "contracted") return null;
  if (contactsExpired(c)) {
    // Past the period: erase (once) and show nothing.
    if (run("DELETE FROM contract_contacts WHERE contract_id = ?", c.id).changes) appendContractEvent(c.id, "system", null, "contacts_expired", c.terms_hash);
    return null;
  }
  const rows = all<ContractContact>("SELECT * FROM contract_contacts WHERE contract_id = ?", c.id).map((r) => ({
    ...r,
    name: decryptField(r.name),
    phone: decryptField(r.phone),
    email: decryptField(r.email),
    address: decryptField(r.address),
    hours: decryptField(r.hours),
  }));
  const mine = rows.find((r) => r.side === viewer.side) ?? null;
  const theirs = rows.find((r) => r.side !== viewer.side) ?? null;
  if (theirs) insert("contact_access_log", { id: newId("cal"), contract_id: c.id, viewer_user_id: viewer.userId, viewer_side: viewer.side, created_at: now() });
  return { mine, theirs };
}
