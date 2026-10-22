// Scheduled purge of expired personal data, attempt limits, and the AI draft staying off unless switched on.
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-hard-"));
process.env.STORAGE_DIR = dir;

describe("hardening", async () => {
  const db = await import("../db");
  const { purgeExpired } = await import("../retention");
  const { hitRateLimit, clearRateLimit, RATE_LIMIT_MESSAGE } = await import("../rate-limit");
  const ai = await import("../ai-draft");
  const visits = await import("../visits");
  const { matchForUser } = await import("../access");
  const { encryptField } = await import("../field-crypto");
  type User = import("../types").User;
  const env = { ...process.env };

  beforeAll(() => {
    db.db();
  });
  afterEach(() => {
    for (const k of ["AI_DRAFT_ENABLED", "ANTHROPIC_API_KEY"]) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  });

  it("erases expired visit addresses and contract contacts without anyone opening a page", () => {
    const customer = db.get<User>("SELECT * FROM users WHERE email = 'yamada@demo.sumatch.jp'")!;
    const m = db.get<{ id: string; company_id: string }>("SELECT m.id, m.company_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' LIMIT 1", customer.id)!;
    const co = db.get<User>("SELECT u.* FROM users u JOIN company_members cm ON cm.user_id = u.id WHERE cm.company_id = ? AND cm.member_role = 'owner'", m.company_id)!;
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString();
    const id = visits.proposeVisit(matchForUser(m.id, co)!, co.id, { slots: [soon], note: "" });
    visits.approveVisit(matchForUser(m.id, customer)!, customer.id, { visitId: id, slot: new Date(soon).toISOString(), address: "藤沢市辻堂1-1-1", accessNote: "", consent: true });
    // A visit still in its period is kept.
    expect(purgeExpired().visitAddresses).toBe(0);
    // 10 days later (visit + 7 days passed): erased, logged.
    const r = purgeExpired(new Date(Date.now() + 10 * 86400_000));
    expect(r.visitAddresses).toBe(1);
    expect(db.get<{ a: string | null }>("SELECT address_enc a FROM site_visits WHERE id = ?", id)!.a).toBeNull();
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM site_visit_events WHERE visit_id = ? AND action = 'address_expired'", id)!.n).toBe(1);

    // Contacts of a contract completed long ago.
    const c = db.get<{ id: string }>("SELECT c.id FROM contracts c JOIN contract_contacts cc ON cc.contract_id = c.id WHERE c.status = 'completed' LIMIT 1")!;
    db.run("UPDATE contracts SET end_date = '2020-01-01' WHERE id = ?", c.id);
    db.run("UPDATE contract_contacts SET phone = ? WHERE contract_id = ?", encryptField("090-0000-0000"), c.id);
    expect(purgeExpired().contractContacts).toBe(1);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM contract_contacts WHERE contract_id = ?", c.id)!.n).toBe(0);
    // Running again changes nothing.
    expect(purgeExpired()).toMatchObject({ visitAddresses: 0, contractContacts: 0 });
  });

  it("limits attempts per key; other keys are unaffected; a success can clear the count", () => {
    for (let i = 0; i < 5; i++) hitRateLimit("login:email:x@example.com", 5, 900);
    expect(() => hitRateLimit("login:email:x@example.com", 5, 900)).toThrow(RATE_LIMIT_MESSAGE);
    expect(() => hitRateLimit("login:email:y@example.com", 5, 900)).not.toThrow();
    clearRateLimit("login:email:x@example.com");
    expect(() => hitRateLimit("login:email:x@example.com", 5, 900)).not.toThrow();
    // An expired window starts over.
    db.run("UPDATE rate_limits SET window_end = '2000-01-01T00:00:00.000Z' WHERE key = 'login:email:y@example.com'");
    for (let i = 0; i < 5; i++) hitRateLimit("login:email:y@example.com", 5, 900);
    expect(purgeExpired().rateLimits).toBe(0);
  });

  it("the AI draft is off unless AI_DRAFT_ENABLED=true, even with an API key present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
    delete process.env.AI_DRAFT_ENABLED;
    expect(ai.aiDraftEnabled()).toBe(false);
    const r = await ai.draftReply({ side: "company", companyName: "湘南ペイント", customerName: "山田 太郎", categoryName: "外壁", city: "藤沢市", projectSummary: "外壁", messages: [] });
    expect(r.source).toBe("template");
    process.env.AI_DRAFT_ENABLED = "true";
    expect(ai.aiDraftEnabled()).toBe(true);
  });

  it("text sent to the AI has names, phone numbers, email addresses and links removed", () => {
    const out = ai.redactForAi("山田 太郎です。太郎宛に 090-1234-5678 か taro@example.com、https://line.me/x まで", ["山田 太郎"]);
    expect(out).not.toMatch(/山田|太郎|090|example|line\.me/);
    expect(out).toContain("〔電話番号〕");
    expect(out).toContain("〔メール〕");
    // Amounts and dates stay.
    expect(ai.redactForAi("税込1,100,000円、12/3 9:30から", [])).toContain("1,100,000円");
  });

  it("per-origin limits use the address added by the trusted proxy, not one the client wrote", async () => {
    const { clientIp } = await import("../rate-limit");
    const h = (xff: string) => new Headers({ "x-forwarded-for": xff });
    // The client forged "1.1.1.1"; the proxy appended the real address last.
    expect(clientIp(h("1.1.1.1, 203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIp(h("1.1.1.1, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
    expect(clientIp(h("1.1.1.1"), 0)).toBe("direct");
    expect(clientIp(new Headers(), 1)).toBe("unknown");
    // behind a Cloudflare tunnel: the edge sets cf-connecting-ip, a client-sent X-Forwarded-For is ignored
    const cf = new Headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.1.1.1" });
    expect(clientIp(cf, 1, "cf-connecting-ip")).toBe("198.51.100.7");
    expect(clientIp(h("1.1.1.1"), 1, "cf-connecting-ip")).toBe("unknown");
  });

  it("the limited-test gate admits only the configured credentials", async () => {
    const { siteGateAllows } = await import("../site-gate");
    const basic = (s: string) => `Basic ${btoa(s)}`;
    expect(siteGateAllows(basic("beta:secret-pass"), undefined)).toBeNull();
    expect(siteGateAllows(null, "beta:secret-pass")).toBe(false);
    expect(siteGateAllows(basic("beta:wrong"), "beta:secret-pass")).toBe(false);
    expect(siteGateAllows("Basic %%%", "beta:secret-pass")).toBe(false);
    expect(siteGateAllows(basic("beta:secret-pass"), "beta:secret-pass")).toBe(true);
  });

  it("changes made directly in the database are recorded in db_audit, which cannot be edited", () => {
    const c = db.get<{ id: string; amount: number }>("SELECT id, amount FROM contracts LIMIT 1")!;
    const before = db.get<{ n: number }>("SELECT COUNT(*) n FROM db_audit")!.n;
    // As if someone opened the file with a SQLite tool:
    db.db().exec(`UPDATE contracts SET amount = amount + 1 WHERE id = '${c.id}'`);
    db.db().exec(`UPDATE contract_events SET detail = 'x' WHERE contract_id = '${c.id}' AND seq = 1`);
    const rows = db.all<{ tbl: string; action: string; detail: string }>("SELECT tbl, action, detail FROM db_audit ORDER BY id DESC LIMIT 2");
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM db_audit")!.n).toBe(before + 2);
    expect(rows.map((r) => r.tbl).sort()).toEqual(["contract_events", "contracts"]);
    expect(JSON.parse(rows.find((r) => r.tbl === "contracts")!.detail).amount).toEqual([c.amount, c.amount + 1]);
    expect(() => db.db().exec("DELETE FROM db_audit")).toThrow(/append-only/);
    expect(() => db.db().exec("UPDATE db_audit SET detail = ''")).toThrow(/append-only/);
  });
});
