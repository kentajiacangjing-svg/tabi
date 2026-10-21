// Personal data at rest and who can read what (other companies, other customers, anonymous).
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-sec-"));
process.env.STORAGE_DIR = dir;

describe("personal data protection and access control", async () => {
  const db = await import("../db");
  const crypto = await import("../field-crypto");
  const access = await import("../access");
  const contract = await import("../contract");
  type User = import("../types").User;
  type FileRow = import("../types").FileRow;
  const env = { ...process.env };

  const user = (email: string) => db.get<User>("SELECT * FROM users WHERE email = ?", email)!;
  const ownerOf = (companyId: string) => db.get<User>("SELECT u.* FROM users u JOIN company_members m ON m.user_id = u.id WHERE m.company_id = ? AND m.member_role = 'owner'", companyId)!;

  beforeAll(() => {
    db.db();
  });
  afterEach(() => {
    for (const k of ["DATA_ENCRYPTION_KEY", "DATA_ENCRYPTION_KEYS_OLD", "NODE_ENV", "DEMO_MODE"]) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    crypto.resetKeyCache();
  });

  it("encrypts with a random IV, detects tampering and survives key rotation", () => {
    const a = crypto.encryptField("090-1234-5678");
    const b = crypto.encryptField("090-1234-5678");
    expect(a).not.toBe(b);
    expect(a).not.toContain("1234");
    expect(crypto.decryptField(a)).toBe("090-1234-5678");
    const tampered = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(crypto.decryptField(tampered)).toBe("");
    // Rotation: the old key goes to DATA_ENCRYPTION_KEYS_OLD and still opens old values.
    const k1 = randomBytes(32).toString("base64");
    const k2 = randomBytes(32).toString("base64");
    process.env.DATA_ENCRYPTION_KEY = k1;
    crypto.resetKeyCache();
    const old = crypto.encryptField("藤沢市辻堂1-2-3");
    process.env.DATA_ENCRYPTION_KEY = k2;
    process.env.DATA_ENCRYPTION_KEYS_OLD = k1;
    crypto.resetKeyCache();
    expect(crypto.decryptField(old)).toBe("藤沢市辻堂1-2-3");
    expect(crypto.encryptField("x")).not.toContain(old.split(":")[2]);
    // Without the old key the value cannot be read (and nothing crashes).
    delete process.env.DATA_ENCRYPTION_KEYS_OLD;
    crypto.resetKeyCache();
    expect(crypto.decryptField(old)).toBe("");
  });

  it("refuses to handle sensitive data in production without a configured key", () => {
    Object.assign(process.env, { NODE_ENV: "production", DEMO_MODE: "false" });
    delete process.env.DATA_ENCRYPTION_KEY;
    crypto.resetKeyCache();
    expect(() => crypto.encryptField("090-0000-0000")).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it("stores contract contacts encrypted: the database file has no plain value", () => {
    const rows = db.all<{ phone: string; email: string; address: string }>("SELECT phone, email, address FROM contract_contacts");
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) for (const v of [r.phone, r.email, r.address].filter(Boolean)) expect(crypto.isEncrypted(v)).toBe(true);
    db.db().exec("PRAGMA wal_checkpoint(TRUNCATE)");
    const bytes = fs.readFileSync(path.join(dir, "sumatch.db"));
    expect(bytes.includes(Buffer.from("suzuki@example.com"))).toBe(false);
    expect(bytes.includes(Buffer.from("サンプル住所"))).toBe(false);
    // and the app still reads them for the right person
    const c = db.get<import("../types").Contract>("SELECT * FROM contracts WHERE stage = 'contracted' LIMIT 1")!;
    const company = ownerOf(c.company_id);
    expect(contract.contractContactsFor(c, { side: "company", userId: company.id })?.theirs?.email).toMatch(/@example\.com$/);
  });

  it("other customers, other companies and anonymous users cannot read conversations or private files", () => {
    const yamada = user("yamada@demo.sumatch.jp");
    const ito = user("ito@demo.sumatch.jp");
    const admin = user("admin@demo.sumatch.jp");
    const matched = db.get<{ id: string; company_id: string; project_id: string }>("SELECT m.id, m.company_id, m.project_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' LIMIT 1", yamada.id)!;
    const ownCompany = ownerOf(matched.company_id);
    const otherCompany = db.get<{ id: string }>("SELECT id FROM companies WHERE id NOT IN (SELECT company_id FROM matches WHERE project_id = ?) LIMIT 1", matched.project_id)!;
    const stranger = ownerOf(otherCompany.id);

    expect(access.matchForUser(matched.id, yamada)?.side).toBe("customer");
    expect(access.matchForUser(matched.id, ownCompany)?.side).toBe("company");
    expect(access.matchForUser(matched.id, ito)).toBeNull();
    expect(access.matchForUser(matched.id, stranger)).toBeNull();
    expect(access.projectForCustomer(matched.project_id, ito)).toBeNull();

    const file = (scope: FileRow["scope"], scopeId: string, owner: string): FileRow =>
      ({ id: "f", owner_user_id: owner, scope, scope_id: scopeId, mime: "image/png", size: 1, original_name: "x", storage_path: "x", created_at: db.now() }) as FileRow;
    const projectPhoto = file("project", matched.project_id, yamada.id);
    const chatFile = file("match", matched.id, yamada.id);
    const c = db.get<{ id: string; company_id: string; customer: string }>("SELECT c.id, c.company_id, p.customer_id AS customer FROM contracts c JOIN projects p ON p.id = c.project_id LIMIT 1")!;
    const contractDoc = file("contract", c.id, ownerOf(c.company_id).id);
    const notThisCompany = db.get<{ id: string }>("SELECT id FROM companies WHERE id != ? LIMIT 1", c.company_id)!;

    expect(access.canReadFile(null, projectPhoto)).toBe(false);
    expect(access.canReadFile(ito, projectPhoto)).toBe(false);
    expect(access.canReadFile(stranger, projectPhoto)).toBe(false);
    expect(access.canReadFile(ownCompany, chatFile)).toBe(true);
    expect(access.canReadFile(stranger, chatFile)).toBe(false);
    expect(access.canReadFile(ito, chatFile)).toBe(false);
    expect(access.canReadFile(db.get<User>("SELECT * FROM users WHERE id = ?", c.customer)!, contractDoc)).toBe(true);
    expect(access.canReadFile(ownerOf(notThisCompany.id), contractDoc)).toBe(false);
    expect(access.canReadFile(ito, contractDoc)).toBe(false);
    expect(access.canReadFile(null, contractDoc)).toBe(false);
    // The operator can read for support, and every such read is recorded.
    expect(access.canReadFile(admin, contractDoc)).toBe(true);
    const before = db.get<{ n: number }>("SELECT COUNT(*) n FROM admin_access_log")!.n;
    access.logAdminAccess(admin, "file", contractDoc.id);
    access.logAdminAccess(yamada, "file", contractDoc.id);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM admin_access_log")!.n).toBe(before + 1);
  });
});
