// Scheduled clean-up of personal data past its display period, independent of anyone opening a page.
// Runs hourly inside each server process (instrumentation.ts) and on POST /api/cron/purge. Idempotent.
//
//   • 現地調査の住所: visible_until (訪問日+VISIT_ADDRESS_DAYS) を過ぎたら住所とメモを消去
//   • 契約後の連絡先: 工事完了日+CONTACT_DAYS_AFTER_COMPLETION を過ぎたら削除
//   • 期限切れのログインセッション、古い回数制限の記録
// What is NOT deleted here (retention periods are a legal decision): accounts, chats, contracts, histories.
import { all, now, run, tx } from "./db";
import { appendContractEvent, CONTACT_DAYS_AFTER_COMPLETION } from "./contract";
import { insert, newId } from "./db";

export function purgeExpired(at = new Date()) {
  const ts = at.toISOString();
  return tx(() => {
    const visits = all<{ id: string }>("SELECT id FROM site_visits WHERE visible_until < ? AND (address_enc IS NOT NULL OR access_note_enc IS NOT NULL)", ts);
    for (const v of visits) {
      run("UPDATE site_visits SET address_enc = NULL, access_note_enc = NULL WHERE id = ?", v.id);
      insert("site_visit_events", { id: newId("sve"), visit_id: v.id, action: "address_expired", actor_side: "system", actor_user_id: null, detail: "address erased", created_at: now() });
    }
    const cutoff = new Date(at.getTime() - CONTACT_DAYS_AFTER_COMPLETION * 86400_000).toISOString().slice(0, 10);
    const contracts = all<{ id: string; terms_hash: string }>(
      "SELECT DISTINCT c.id, c.terms_hash FROM contracts c JOIN contract_contacts cc ON cc.contract_id = c.id WHERE c.status = 'completed' AND c.end_date IS NOT NULL AND c.end_date < ?",
      cutoff,
    );
    for (const c of contracts) {
      run("DELETE FROM contract_contacts WHERE contract_id = ?", c.id);
      appendContractEvent(c.id, "system", null, "contacts_expired", c.terms_hash);
    }
    const sessions = run("DELETE FROM sessions WHERE expires_at < ?", ts).changes;
    const limits = run("DELETE FROM rate_limits WHERE window_end < ?", ts).changes;
    return { visitAddresses: visits.length, contractContacts: contracts.length, sessions: Number(sessions), rateLimits: Number(limits) };
  });
}
