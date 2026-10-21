// Notification email queue: no real sending, no duplicates, retries with backoff, opt-out respected.
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-mail-"));
process.env.STORAGE_DIR = dir;

describe("notification email queue", async () => {
  const db = await import("../db");
  const { notify } = await import("../notify");
  const mailer = await import("../mailer");
  type OutboxMail = import("../mailer").OutboxMail;
  let userId: string;
  const rows = () => db.all<{ id: string; status: string; attempts: number; last_error: string; body: string }>("SELECT * FROM email_outbox WHERE user_id = ? ORDER BY created_at", userId);

  beforeAll(() => {
    db.db();
    userId = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'ito@demo.sumatch.jp'")!.id;
    db.run("DELETE FROM email_outbox");
  });
  afterEach(() => {
    delete process.env.MAIL_TRANSPORT;
  });

  it("queues one email per notice even when the same notice fires twice; chat messages are not emailed", () => {
    notify([userId], "quote", "見積が届きました", "湘南ペイントから見積が届きました。", "/quotes?project=p1");
    notify([userId], "quote", "見積が届きました", "湘南ペイントから見積が届きました。", "/quotes?project=p1");
    notify([userId], "message", "新しいメッセージ", "…", "/messages/m1");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].status).toBe("queued");
  });

  it("without a transport nothing is sent and mail stays queued", async () => {
    expect(mailer.mailTransportName()).toBe("none");
    expect(mailer.mailIsDelivered()).toBe(false);
    const r = await mailer.deliverOutbox();
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
    expect(rows()[0].status).toBe("queued");
  });

  it("a failing transport is retried with backoff, then gives up; the error is kept short", async () => {
    const failing = async () => {
      throw new Error("SMTP 421 try later");
    };
    await mailer.deliverOutbox(failing);
    let r = rows()[0];
    expect(r).toMatchObject({ status: "failed", attempts: 1, last_error: "SMTP 421 try later" });
    // Not due yet (backoff): nothing happens.
    expect((await mailer.deliverOutbox(failing)).failed).toBe(0);
    for (let i = 0; i < 10; i++) {
      db.run("UPDATE email_outbox SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", r.id);
      await mailer.deliverOutbox(failing);
    }
    r = rows()[0];
    expect(r.attempts).toBe(mailer.MAX_ATTEMPTS);
    expect(r.status).toBe("failed");
    // The operator can put it back; a working transport then sends it once.
    expect(mailer.requeueFailed(r.id)).toBe(1);
    const sent: OutboxMail[] = [];
    await mailer.deliverOutbox(async (m) => void sent.push(m));
    expect(sent).toHaveLength(1);
    expect(rows()[0].status).toBe("sent");
  });

  it("two deliveries running at once send each mail once", async () => {
    notify([userId], "contract", "契約条件が届きました", "内容を確認してください。", "/projects/p2");
    const sent: string[] = [];
    const slow = async (m: OutboxMail) => {
      await new Promise((r) => setTimeout(r, 20));
      sent.push(m.id);
    };
    await Promise.all([mailer.deliverOutbox(slow), mailer.deliverOutbox(slow), mailer.deliverOutbox(slow)]);
    expect(sent).toHaveLength(1);
  });

  it("someone who turned email off after queueing is not emailed", async () => {
    notify([userId], "contract", "双方の合意を確認しました", "…", "/projects/p3");
    db.run("UPDATE users SET notify_email = 0 WHERE id = ?", userId);
    const sent: string[] = [];
    const r = await mailer.deliverOutbox(async (m) => void sent.push(m.id));
    expect(r.suppressed).toBe(1);
    expect(sent).toHaveLength(0);
    db.run("UPDATE users SET notify_email = 1 WHERE id = ?", userId);
  });

  it("the mock transport writes to a sandbox file, not to anyone's inbox; mail bodies hold only a link", async () => {
    process.env.MAIL_TRANSPORT = "mock";
    notify([userId], "system", "現地調査の日時が決まりました", "11/3(火) 10:00。訪問先は現地調査ページで確認できます。", "/messages/m9/visit");
    const r = await mailer.deliverOutbox();
    expect(r.sent).toBe(1);
    const sandbox = fs.readFileSync(path.join(dir, "mail-sandbox.jsonl"), "utf8");
    expect(sandbox).toContain("現地調査の日時が決まりました");
    for (const row of rows()) expect(row.body).not.toMatch(/\d{2,4}-\d{2,4}-\d{3,4}|@example/);
  });
});
