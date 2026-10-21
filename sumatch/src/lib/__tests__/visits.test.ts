// 現地調査 before a contract, public text checks, and contact withdrawal / expiry after a contract.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-visit-"));
process.env.STORAGE_DIR = dir;

describe("site visits and contact details", async () => {
  const db = await import("../db");
  const visits = await import("../visits");
  const contract = await import("../contract");
  const { matchForUser } = await import("../access");
  const { CONTACT_BLOCK_MESSAGE, blockedInPublicText } = await import("../contact-detect");
  const { isEncrypted } = await import("../field-crypto");
  type User = import("../types").User;
  const user = (email: string) => db.get<User>("SELECT * FROM users WHERE email = ?", email)!;
  const ownerOf = (companyId: string) => db.get<User>("SELECT u.* FROM users u JOIN company_members m ON m.user_id = u.id WHERE m.company_id = ? AND m.member_role = 'owner'", companyId)!;
  const inDays = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();
  let customer: User, co: User, admin: User, matchId: string, otherCo: User;

  beforeAll(() => {
    db.db();
    customer = user("yamada@demo.sumatch.jp");
    admin = user("admin@demo.sumatch.jp");
    const ms = db.all<{ id: string; company_id: string }>("SELECT m.id, m.company_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' ORDER BY m.score DESC", customer.id);
    matchId = ms[0].id;
    co = ownerOf(ms[0].company_id);
    otherCo = ownerOf(ms[1].company_id);
  });
  const ctx = (u: User) => matchForUser(matchId, u)!;

  it("only the company proposes; dates must be future; the note cannot carry contact details", () => {
    expect(() => visits.proposeVisit(ctx(customer), customer.id, { slots: [inDays(3)], note: "" })).toThrow();
    expect(() => visits.proposeVisit(ctx(co), co.id, { slots: [inDays(-1)], note: "" })).toThrow(/過去/);
    expect(() => visits.proposeVisit(ctx(co), co.id, { slots: [inDays(3)], note: "当日は 090-1234-5678 へ" })).toThrow(CONTACT_BLOCK_MESSAGE);
    visits.proposeVisit(ctx(co), co.id, { slots: [inDays(3), inDays(4)], note: "1時間ほどです" });
    expect(() => visits.proposeVisit(ctx(co), co.id, { slots: [inDays(5)], note: "" })).toThrow(/進行中/);
  });

  it("the address is disclosed only with explicit consent, encrypted, and never put in chat or notifications", () => {
    const v = visits.visitsFor(ctx(customer), customer.id)[0];
    const base = { visitId: v.id, slot: v.slots[0], address: "藤沢市辻堂元町1-2-3", accessNote: "", consent: false };
    expect(() => visits.approveVisit(ctx(customer), customer.id, base)).toThrow(/同意/);
    expect(() => visits.approveVisit(ctx(co), co.id, { ...base, consent: true })).toThrow();
    expect(() => visits.approveVisit(ctx(customer), customer.id, { ...base, slot: inDays(9), consent: true })).toThrow(/候補/);
    expect(() => visits.approveVisit(ctx(customer), customer.id, { ...base, accessNote: "着いたら taro@example.com に", consent: true })).toThrow(CONTACT_BLOCK_MESSAGE);
    visits.approveVisit(ctx(customer), customer.id, { ...base, accessNote: "駐車場は1台分あります", consent: true });
    // Retry / double tap
    visits.approveVisit(ctx(customer), customer.id, { ...base, consent: true });
    const raw = db.get<{ address_enc: string; consent_json: string }>("SELECT address_enc, consent_json FROM site_visits WHERE id = ?", v.id)!;
    expect(isEncrypted(raw.address_enc)).toBe(true);
    const consent = JSON.parse(raw.consent_json);
    expect(consent).toMatchObject({ visit_at: v.slots[0], items: ["訪問先住所", "訪問時のメモ"] });
    expect(raw.consent_json).not.toContain("辻堂");
    for (const t of ["messages", "notifications", "email_outbox", "site_visit_events", "contract_events"]) {
      const rows = db.all<Record<string, unknown>>(`SELECT * FROM ${t}`);
      expect(JSON.stringify(rows)).not.toContain("辻堂元町");
    }
  });

  it("the company sees the address (each view logged); other companies and the operator do not", () => {
    const seen = visits.visitsFor(ctx(co), co.id)[0];
    expect(seen.address).toBe("藤沢市辻堂元町1-2-3");
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM site_visit_events WHERE visit_id = ? AND action = 'address_viewed'", seen.id)!.n).toBe(1);
    expect(matchForUser(matchId, otherCo)).toBeNull();
    expect(visits.visitsFor(ctx(admin), admin.id)[0].address).toBeNull();
  });

  it("after the period the address is erased; cancelling erases it too", () => {
    const v = visits.visitsFor(ctx(co), co.id)[0];
    db.run("UPDATE site_visits SET visible_until = ? WHERE id = ?", inDays(-1), v.id);
    expect(visits.visitsFor(ctx(co), co.id)[0].address).toBeNull();
    expect(db.get<{ a: string | null }>("SELECT address_enc a FROM site_visits WHERE id = ?", v.id)!.a).toBeNull();
    visits.closeVisit(ctx(customer), customer.id, v.id);
    expect(db.get<{ status: string }>("SELECT status FROM site_visits WHERE id = ?", v.id)!.status).toBe("cancelled");
    // A new visit can be proposed and then cancelled by the company; the address is gone.
    const id = visits.proposeVisit(ctx(co), co.id, { slots: [inDays(6)], note: "" });
    visits.approveVisit(ctx(customer), customer.id, { visitId: id, slot: visits.visitsFor(ctx(customer), customer.id)[0].slots[0], address: "藤沢市鵠沼1-1", accessNote: "", consent: true });
    visits.closeVisit(ctx(co), co.id, id);
    expect(db.get<{ a: string | null; s: string }>("SELECT address_enc a, status s FROM site_visits WHERE id = ?", id)).toEqual({ a: null, s: "cancelled" });
  });

  it("public texts (profiles, works, consultations, reviews) refuse contact details but keep normal text", () => {
    expect(blockedInPublicText(["ご相談はお電話 0466-12-3456 まで"])).toEqual(["phone"]);
    expect(blockedInPublicText(["インスタのDMでどうぞ @shonan_paint"])).toContain("sns");
    expect(blockedInPublicText(["創業15年、外壁塗装 1,200件。営業 9:00〜18:00", "TOTO サザナ 1216 対応"])).toEqual([]);
  });

  it("after 契約成立 either side can withdraw its contact details, and they are erased after the period", () => {
    const c = db.get<import("../types").Contract>("SELECT * FROM contracts WHERE stage = 'contracted' AND status = 'in_progress' LIMIT 1")!;
    const cust = db.get<User>("SELECT u.* FROM users u JOIN projects p ON p.customer_id = u.id WHERE p.id = ?", c.project_id)!;
    const comp = ownerOf(c.company_id);
    const cctx = (u: User) => matchForUser(c.match_id, u)!;
    expect(contract.contractContactsFor(c, { side: "company", userId: comp.id })?.theirs).not.toBeNull();
    contract.revokeContractContact(cctx(cust), cust.id);
    expect(contract.contractContactsFor(c, { side: "company", userId: comp.id })?.theirs).toBeNull();
    // Completed long ago → nothing shown and the rows are gone.
    db.run("UPDATE contracts SET status = 'completed', end_date = ? WHERE id = ?", "2020-01-01", c.id);
    const done = db.get<import("../types").Contract>("SELECT * FROM contracts WHERE id = ?", c.id)!;
    expect(contract.contractContactsFor(done, { side: "customer", userId: cust.id })).toBeNull();
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM contract_contacts WHERE contract_id = ?", c.id)!.n).toBe(0);
    expect(contract.contractHistory(c.id).map((e) => e.action)).toEqual(expect.arrayContaining(["contact_revoked", "contacts_expired"]));
    expect(contract.verifyContractHistory(c.id)).toBe(true);
  });
});
