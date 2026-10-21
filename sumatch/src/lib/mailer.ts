// Delivery of queued notification emails (email_outbox). Nothing is sent to real addresses yet:
//   MAIL_TRANSPORT=none (default) — mail stays queued; the screens say email is not being sent.
//   MAIL_TRANSPORT=mock           — "delivered" to STORAGE_DIR/mail-sandbox.jsonl for testing.
// A real transport (SMTP / an email API) is to be added only after the operator approves it.
//
// Rules: each row is claimed atomically (safe with several processes); failures are retried with backoff
// up to MAX_ATTEMPTS; a person who turned email off since queueing is skipped (suppressed).
import fs from "node:fs";
import path from "node:path";
import { all, get, now, run, tx } from "./db";

export const MAX_ATTEMPTS = 5;

export interface OutboxMail {
  id: string;
  to_email: string;
  user_id: string | null;
  kind: string;
  subject: string;
  body: string;
  attempts: number;
}

export type Transport = (mail: OutboxMail) => Promise<void>;

export function mailTransportName(): "none" | "mock" {
  return process.env.MAIL_TRANSPORT === "mock" ? "mock" : "none";
}

/** True when notification emails actually leave the queue (to the sandbox in "mock" mode). */
export const mailIsDelivered = () => mailTransportName() !== "none";

export const mockTransport: Transport = async (mail) => {
  const file = path.join(path.resolve(process.env.STORAGE_DIR || "./storage"), "mail-sandbox.jsonl");
  fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), to: mail.to_email, subject: mail.subject, body: mail.body }) + "\n");
};

function transportFromEnv(): Transport | null {
  return mailTransportName() === "mock" ? mockTransport : null;
}

const backoffMinutes = (attempts: number) => Math.min(60, 2 ** attempts);

/** Claim and deliver due mail. Returns counts. Without a transport nothing happens. */
export async function deliverOutbox(transport: Transport | null = transportFromEnv(), limit = 50) {
  const out = { sent: 0, failed: 0, suppressed: 0, skipped: 0 };
  if (!transport) {
    out.skipped = get<{ n: number }>("SELECT COUNT(*) n FROM email_outbox WHERE status IN ('queued','failed')")?.n ?? 0;
    return out;
  }
  const ts = now();
  // A process that died while sending leaves rows in 'sending'; after the claim timeout they are retried.
  run("UPDATE email_outbox SET status = 'failed', last_error = 'claim timed out' WHERE status = 'sending' AND next_attempt_at < ?", ts);
  const due = all<OutboxMail>(
    `SELECT id, to_email, user_id, kind, subject, body, attempts FROM email_outbox
      WHERE status IN ('queued','failed') AND attempts < ? AND COALESCE(next_attempt_at, created_at) <= ? ORDER BY created_at LIMIT ?`,
    MAX_ATTEMPTS,
    ts,
    limit,
  );
  for (const m of due) {
    // Claim: only one process gets each row.
    const claimUntil = new Date(Date.now() + 10 * 60_000).toISOString();
    const claimed = tx(() => run("UPDATE email_outbox SET status = 'sending', next_attempt_at = ? WHERE id = ? AND status IN ('queued','failed')", claimUntil, m.id).changes === 1);
    if (!claimed) continue;
    const pref = m.user_id ? get<{ notify_email: number; status: string }>("SELECT notify_email, status FROM users WHERE id = ?", m.user_id) : null;
    if (m.user_id && (!pref || !pref.notify_email || pref.status !== "active")) {
      run("UPDATE email_outbox SET status = 'suppressed' WHERE id = ?", m.id);
      out.suppressed++;
      continue;
    }
    try {
      await transport(m);
      run("UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, sent_at = ?, last_error = '' WHERE id = ?", now(), m.id);
      out.sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      const next = new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString();
      // The error text is kept short and never includes the mail body.
      const msg = (e instanceof Error ? e.message : "send failed").slice(0, 200);
      run("UPDATE email_outbox SET status = 'failed', attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?", attempts, next, msg, m.id);
      out.failed++;
    }
  }
  return out;
}

/** Put mail that ran out of attempts back in the queue (operator action). */
export function requeueFailed(id: string) {
  return run("UPDATE email_outbox SET status = 'queued', attempts = 0, next_attempt_at = ?, last_error = '' WHERE id = ? AND status = 'failed'", now(), id).changes;
}
