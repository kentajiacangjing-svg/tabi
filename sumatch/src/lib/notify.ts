// 通知: アプリ内通知 + メール(送信キュー) + ブラウザ通知(SSE経由)。
// LINE公式 / LINE WORKS は「通知用途のみ」のチャネルとして deliver() に追加する想定。
// 会話そのものは必ず SUMATCH 内で行う（通知本文に連絡先や全文を載せない）。
import { all, get, newId, now, run, insert } from "./db";
import { publish } from "./realtime";

export type NotifyKind =
  | "new_lead"
  | "match"
  | "message"
  | "quote"
  | "contract"
  | "quote_due"
  | "company_review"
  | "system";

const APP_URL = () => process.env.APP_URL || "http://localhost:3100";

export function notify(userIds: string[], kind: NotifyKind, title: string, body: string, link: string) {
  const ts = now();
  for (const userId of new Set(userIds)) {
    insert("notifications", { id: newId("ntf"), user_id: userId, kind, title, body, link, created_at: ts });
    const u = get<{ email: string; notify_email: number }>("SELECT email, notify_email FROM users WHERE id = ?", userId);
    // Chat messages are batched in the inbox already; email only for important events.
    if (u?.notify_email && kind !== "message") {
      // The same notice to the same person within the same minute is queued once (double taps, retries,
      // two processes). The body carries no message text, contact details or addresses — only a link.
      run(
        `INSERT OR IGNORE INTO email_outbox (id, to_email, user_id, kind, subject, body, channel, status, dedupe_key, attempts, next_attempt_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'email', 'queued', ?, 0, ?, ?)`,
        newId("mail"),
        u.email,
        userId,
        kind,
        `【SUMATCH】${title}`,
        `${body}\n\nSUMATCHで確認する: ${APP_URL()}${link}\n\n※ このメールは通知専用です。返信はSUMATCH内のチャットからお願いします。`,
        `${userId}|${kind}|${title}|${link}|${ts.slice(0, 16)}`,
        ts,
        ts,
      );
    }
  }
  publish(userIds, { type: "notification", title, body, link });
}

export function companyUserIds(companyId: string) {
  return all<{ user_id: string }>("SELECT user_id FROM company_members WHERE company_id = ?", companyId).map((r) => r.user_id);
}

export function adminUserIds() {
  return all<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND status = 'active'").map((r) => r.id);
}
