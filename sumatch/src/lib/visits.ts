// 現地調査 (site visit) before a contract — the one exception to "no contact details before the contract".
//
//   1. The company proposes 1–3 dates (and an optional note, checked for contact details like any text).
//   2. The customer picks a date, enters the visit address and explicitly approves disclosing it — to this
//      company only, for this visit only. What was shown at approval (company, date, items, period) is saved.
//   3. The company's members can read the address until VISIT_ADDRESS_DAYS after the visit; each read is logged.
//   4. Either side can cancel; the address is then erased. After the period it is erased on the next read.
// The address never goes into chat, notifications, the project, a profile or the admin screens.
import { all, get, insert, newId, now, run, tx, update } from "./db";
import { DomainError } from "./errors";
import { decryptField, encryptField } from "./field-crypto";
import { assertNoContactInfo } from "./contract";
import { notify, companyUserIds } from "./notify";
import { publish } from "./realtime";
import type { MatchContext } from "./access";
import type { SiteVisit } from "./types";

/** How long after the visit the company can still read the address (provisional; see docs/release-checklist.md). */
export const VISIT_ADDRESS_DAYS = 7;
const MAX_SLOTS = 3;

function event(visitId: string, action: string, side: string, userId: string | null, detail = "") {
  insert("site_visit_events", { id: newId("sve"), visit_id: visitId, action, actor_side: side, actor_user_id: userId, detail, created_at: now() });
}

function systemMessage(matchId: string, body: string) {
  const ts = now();
  insert("messages", { id: newId("msg"), match_id: matchId, sender_side: "system", kind: "system", body, created_at: ts });
  run("UPDATE matches SET last_message_at = ? WHERE id = ?", ts, matchId);
}

const fmt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

function usable(ctx: MatchContext) {
  if (ctx.match.status !== "matched") throw new DomainError("マッチ中の会社とだけ現地調査を調整できます。");
  if (["cancelled", "completed"].includes(ctx.project.status)) throw new DomainError("この相談では現地調査を調整できません。");
}

/** The company proposes candidate dates (ISO strings in the future). */
export function proposeVisit(ctx: MatchContext, userId: string, input: { slots: string[]; note: string }) {
  if (ctx.side !== "company") throw new DomainError("現地調査の候補日は施工会社から提案します。");
  usable(ctx);
  const slots = [...new Set(input.slots.map((s) => s.trim()).filter(Boolean))];
  if (!slots.length) throw new DomainError("候補日時を1つ以上入力してください。");
  if (slots.length > MAX_SLOTS) throw new DomainError(`候補日時は${MAX_SLOTS}つまでです。`);
  const parsed = slots.map((s) => new Date(s));
  if (parsed.some((d) => Number.isNaN(d.getTime()))) throw new DomainError("候補日時の形式を確認してください。");
  if (parsed.some((d) => d.getTime() < Date.now())) throw new DomainError("過去の日時は候補にできません。");
  const note = String(input.note ?? "").trim().slice(0, 300);
  assertNoContactInfo(ctx, userId, [note], "visit");
  return tx(() => {
    if (get("SELECT 1 FROM site_visits WHERE match_id = ? AND status IN ('proposed','approved')", ctx.match.id))
      throw new DomainError("進行中の現地調査があります。変更する場合は、いまの予定を取り消してから提案してください。");
    const id = newId("sv");
    insert("site_visits", {
      id, match_id: ctx.match.id, company_id: ctx.company.id, proposed_by: userId,
      slots_json: JSON.stringify(parsed.map((d) => d.toISOString()).sort()), note, status: "proposed", created_at: now(),
    });
    event(id, "proposed", "company", userId, `${slots.length} slots`);
    systemMessage(ctx.match.id, `${ctx.company.name}から現地調査の候補日が届きました。「現地調査」から日時を選んでください。`);
    notify([ctx.project.customer_id], "system", "現地調査の候補日が届きました", `${ctx.company.name}から候補日が届きました。`, `/messages/${ctx.match.id}/visit`);
    publish([ctx.project.customer_id, ...companyUserIds(ctx.company.id)], { type: "message", matchId: ctx.match.id });
    return id;
  });
}

/**
 * The customer picks a slot and discloses the visit address. `consent` must be true — the screen shows the
 * company, the date, the items disclosed and the period before the button is enabled; the same facts are saved.
 */
export function approveVisit(ctx: MatchContext, userId: string, input: { visitId: string; slot: string; address: string; accessNote: string; consent: boolean }) {
  if (ctx.side !== "customer") throw new DomainError("訪問の承認はお客様が行います。");
  usable(ctx);
  if (!input.consent) throw new DomainError("開示する内容を確認し、同意のチェックを入れてください。");
  const address = String(input.address ?? "").normalize("NFKC").trim().slice(0, 200);
  const accessNote = String(input.accessNote ?? "").normalize("NFKC").trim().slice(0, 200);
  if (address.length < 4) throw new DomainError("訪問先の住所を入力してください。");
  // The access note is for parking / building entry — not a back door for phone numbers.
  assertNoContactInfo(ctx, userId, [accessNote], "visit");
  return tx(() => {
    const v = get<SiteVisit>("SELECT * FROM site_visits WHERE id = ? AND match_id = ?", input.visitId, ctx.match.id);
    if (!v) throw new DomainError("現地調査の予定が見つかりません。");
    if (v.status === "approved") return { approved: true };
    if (v.status !== "proposed") throw new DomainError("この予定は取り消されています。");
    const slots = JSON.parse(v.slots_json) as string[];
    if (!slots.includes(input.slot)) throw new DomainError("候補の中から日時を選んでください。");
    if (new Date(input.slot).getTime() < Date.now()) throw new DomainError("過去の日時は選べません。会社に別の候補を依頼してください。");
    const until = new Date(new Date(input.slot).getTime() + VISIT_ADDRESS_DAYS * 86400_000).toISOString();
    const ts = now();
    const consent = { company_id: ctx.company.id, company_name: ctx.company.name, visit_at: input.slot, items: ["訪問先住所", ...(accessNote ? ["訪問時のメモ"] : [])], visible_until: until, approved_at: ts };
    update("site_visits", v.id, {
      status: "approved", visit_at: input.slot, address_enc: encryptField(address), access_note_enc: encryptField(accessNote),
      consent_json: JSON.stringify(consent), approved_by: userId, approved_at: ts, visible_until: until,
    });
    event(v.id, "approved", "customer", userId, JSON.stringify(consent));
    systemMessage(ctx.match.id, `現地調査の日時が決まりました（${fmt(input.slot)}）。訪問先は「現地調査」で施工会社だけが確認できます。`);
    notify(companyUserIds(ctx.company.id), "system", "現地調査の日時が決まりました", `${fmt(input.slot)}。訪問先は現地調査ページで確認できます。`, `/business/messages/${ctx.match.id}/visit`);
    publish([ctx.project.customer_id, ...companyUserIds(ctx.company.id)], { type: "message", matchId: ctx.match.id });
    return { approved: true };
  });
}

/** Either side cancels (the customer may also decline a proposal). The address is erased. */
export function closeVisit(ctx: MatchContext, userId: string, visitId: string) {
  if (ctx.side === "admin") throw new DomainError("運営は操作できません。");
  return tx(() => {
    const v = get<SiteVisit>("SELECT * FROM site_visits WHERE id = ? AND match_id = ?", visitId, ctx.match.id);
    if (!v) throw new DomainError("現地調査の予定が見つかりません。");
    if (v.status === "declined" || v.status === "cancelled") return;
    const status = v.status === "proposed" && ctx.side === "customer" ? "declined" : "cancelled";
    update("site_visits", v.id, { status, address_enc: null, access_note_enc: null, closed_by: userId, closed_at: now() });
    event(v.id, status, ctx.side, userId, "address erased");
    systemMessage(ctx.match.id, status === "declined" ? "お客様が現地調査の候補日を見送りました。" : `${ctx.side === "customer" ? "お客様" : ctx.company.name}が現地調査の予定を取り消しました。`);
    const to = ctx.side === "customer" ? companyUserIds(ctx.company.id) : [ctx.project.customer_id];
    notify(to, "system", "現地調査の予定が変わりました", status === "declined" ? "候補日が見送られました。" : "予定が取り消されました。", ctx.side === "customer" ? `/business/messages/${ctx.match.id}/visit` : `/messages/${ctx.match.id}/visit`);
  });
}

export interface VisitView extends Omit<SiteVisit, "address_enc" | "access_note_enc"> {
  slots: string[];
  /** Only for the company while the visit is approved and within its period, and for the customer who entered it. */
  address: string | null;
  accessNote: string | null;
  expired: boolean;
}

/**
 * Visits of this conversation as the viewer may see them. The company's reads of an address are logged;
 * addresses past their period are erased here.
 */
export function visitsFor(ctx: MatchContext, viewerUserId: string): VisitView[] {
  const rows = all<SiteVisit>("SELECT * FROM site_visits WHERE match_id = ? ORDER BY created_at DESC", ctx.match.id);
  const ts = now();
  return rows.map((v) => {
    const expired = !!v.visible_until && v.visible_until < ts;
    if (expired && v.address_enc) {
      update("site_visits", v.id, { address_enc: null, access_note_enc: null });
      event(v.id, "address_expired", "system", null, "address erased");
      v.address_enc = null;
      v.access_note_enc = null;
    }
    const canSee = v.status === "approved" && !expired && !!v.address_enc && (ctx.side === "company" || ctx.side === "customer");
    if (canSee && ctx.side === "company") event(v.id, "address_viewed", "company", viewerUserId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- encrypted columns never leave this module
    const { address_enc: _a, access_note_enc: _n, ...rest } = v;
    return {
      ...rest,
      slots: JSON.parse(v.slots_json) as string[],
      address: canSee ? decryptField(v.address_enc) : null,
      accessNote: canSee ? decryptField(v.access_note_enc) || null : null,
      expired,
    };
  });
}
