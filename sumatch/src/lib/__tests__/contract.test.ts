// 外部連絡先のブロック・依頼先決定・契約条件・双方合意 — the rules enforced on the server.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-contract-"));
process.env.STORAGE_DIR = dir;

describe("contact block + contract agreement", async () => {
  const db = await import("../db");
  const services = await import("../services");
  const contract = await import("../contract");
  const { matchForUser } = await import("../access");
  const { CONTACT_BLOCK_MESSAGE } = await import("../contact-detect");
  type User = import("../types").User;
  type Quote = import("../types").Quote;

  const user = (email: string) => db.get<User>("SELECT * FROM users WHERE email = ?", email)!;
  let customer: User;
  let matches: { id: string; company_id: string }[];
  const owner = (companyId: string) =>
    db.get<User>("SELECT u.* FROM users u JOIN company_members cm ON cm.user_id = u.id WHERE cm.company_id = ? ORDER BY cm.created_at LIMIT 1", companyId)!;
  const ctxFor = (matchId: string, u: User) => matchForUser(matchId, u)!;
  /** A stored file row for a contract document (the bytes are not needed here). */
  const mkFile = (id: string) => {
    db.insert("files", { id, owner_user_id: null, scope: "contract", scope_id: null, mime: "application/pdf", size: 1, original_name: `${id}.pdf`, storage_path: `${id}.pdf`, created_at: db.now() });
    return id;
  };
  const latest = (matchId: string) => contract.latestQuoteForMatch(matchId)!;
  const terms = {
    scope: "外壁・付帯部の塗装（足場含む）",
    start_date: "2026-12-01",
    duration: "約14日",
    materials: "日本ペイント パーフェクトトップ",
    payment_terms: "着工時30%・完了後70%",
    extra_work: "事前に見積を出し、承認後に着手",
    warranty: "外壁10年",
    cancellation: "着工前は無償",
  };
  const quoteInput = (total: number) => ({
    title: "外壁塗装",
    items: [{ name: "外壁塗装一式", quantity: 1, unit: "式", unit_price: Math.round(total / 1.1) }],
    overhead: 0,
    discount: 0,
    warranty: "10年",
    warranty_years: 10,
    duration: "約14日",
    duration_days: 14,
    materials: "シリコン",
    payment_terms: "完工時一括",
    extra_costs: "",
    notes: "",
    valid_until: null,
    pdf_file_id: null,
  });

  beforeAll(() => {
    db.db();
    customer = user("yamada@demo.sumatch.jp");
    matches = db.all("SELECT m.id, m.company_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' ORDER BY m.score DESC", customer.id);
  });

  it("refuses phone / email / LINE in chat before agreement, from both sides, and keeps no text", () => {
    const m = matches[0];
    const before = db.get<{ n: number }>("SELECT COUNT(*) n FROM messages WHERE match_id = ?", m.id)!.n;
    for (const body of ["電話は090-1234-5678です", "taro@example.com に送ってください", "LINE交換しませんか", "ＩＮＳＴＡＧＲＡＭのDMで"]) {
      expect(() => services.postMessage(ctxFor(m.id, customer), customer.id, { kind: "text", body })).toThrow(CONTACT_BLOCK_MESSAGE);
    }
    const co = owner(m.company_id);
    expect(() => services.postMessage(ctxFor(m.id, co), co.id, { kind: "text", body: "お電話 0466-12-3456 まで" })).toThrow(CONTACT_BLOCK_MESSAGE);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM messages WHERE match_id = ?", m.id)!.n).toBe(before);
    const blocks = db.all<{ flags: string; sender_side: string }>("SELECT flags, sender_side FROM contact_blocks WHERE match_id = ?", m.id);
    expect(blocks.length).toBe(5);
    expect(blocks.some((b) => b.sender_side === "company")).toBe(true);
    // The log has no column that could hold the message.
    const cols = db.all<{ name: string }>("PRAGMA table_info(contact_blocks)").map((c) => c.name);
    expect(cols).not.toContain("body");
  });

  it("lets ordinary messages with amounts, dates, sizes and model numbers through", () => {
    const m = matches[0];
    for (const body of ["税込1,100,000円で、12/3 9:30から着工できます", "幅1820×奥行910、TOTO CES9898を想定", "塗料のラインナップを比べたいです"]) {
      expect(() => services.postMessage(ctxFor(m.id, customer), customer.id, { kind: "text", body })).not.toThrow();
    }
  });

  it("refuses contact details hidden in a quote", () => {
    const m = matches[1];
    const co = owner(m.company_id);
    expect(() => services.submitQuote(ctxFor(m.id, co), co.id, { ...quoteInput(1000000), notes: "詳しくは info@example.jp へ" })).toThrow(CONTACT_BLOCK_MESSAGE);
  });

  it("decides only on the latest quote version, and a second tap does not duplicate", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    const v1 = latest(m.id);
    services.submitQuote(ctxFor(m.id, co), co.id, quoteInput(1210000));
    const v2 = latest(m.id);
    expect(v2.version).toBe(v1.version + 1);
    expect(() => services.decideCompany(ctxFor(m.id, customer), { quoteId: v1.id }, customer.id)).toThrow(/更新されています/);
    const id1 = services.decideCompany(ctxFor(m.id, customer), { quoteId: v2.id }, customer.id);
    const id2 = services.decideCompany(ctxFor(m.id, customer), { quoteId: v2.id }, customer.id);
    expect(id2).toBe(id1);
    const c = contract.contractForMatch(m.id)!;
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM contracts WHERE project_id = ?", c.project_id)!.n).toBe(1);
    expect(c.stage).toBe("selected");
    expect(c.amount).toBe(v2.total);
    expect(c.contract_date).toBeNull();
    expect(contract.contactsUnlocked(m.id)).toBe(false);
    // Another company of the same project cannot be chosen now.
    expect(() => services.decideCompany(ctxFor(matches[1].id, customer), { quoteId: latest(matches[1].id).id }, customer.id)).toThrow();
  });

  it("does not start work or unlock contacts while terms are missing", () => {
    const c = contract.contractForMatch(matches[0].id)!;
    expect(() => services.advanceContract(c, "in_progress", "test")).toThrow();
    const co = owner(matches[0].company_id);
    expect(() => contract.saveTerms(ctxFor(matches[0].id, co), co.id, { ...terms, warranty: "" })).toThrow(/保証/);
    expect(() => contract.agreeTerms(ctxFor(matches[0].id, customer), customer.id, "")).toThrow();
    expect(contract.contractForMatch(matches[0].id)!.stage).toBe("selected");
  });

  it("only the company writes terms; the customer cannot", () => {
    expect(() => contract.saveTerms(ctxFor(matches[0].id, customer), customer.id, terms)).toThrow();
    const other = owner(matches[1].company_id);
    expect(matchForUser(matches[0].id, other)).toBeNull();
  });

  it("agrees only to the version shown, and reaches 双方の合意 when both agree the same hash", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    const { hash } = contract.saveTerms(ctxFor(m.id, co), co.id, terms);
    expect(contract.contractForMatch(m.id)!.stage).toBe("terms");
    expect(() => contract.agreeTerms(ctxFor(m.id, customer), customer.id, "stale-hash")).toThrow(/更新されています/);
    expect(contract.agreeTerms(ctxFor(m.id, customer), customer.id, hash).agreed).toBe(false);
    // Repeating (double tap / retry) changes nothing.
    contract.agreeTerms(ctxFor(m.id, customer), customer.id, hash);
    const agreedEvents = () => contract.contractHistory(contract.contractForMatch(m.id)!.id).filter((e) => e.action === "agreed").length;
    expect(agreedEvents()).toBe(1);
    expect(contract.contactsUnlocked(m.id)).toBe(false);
  });

  it("a revised quote clears both agreements and points the terms at the new version", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    const before = contract.contractForMatch(m.id)!;
    expect(before.customer_agreed_at).not.toBeNull();
    services.submitQuote(ctxFor(m.id, co), co.id, quoteInput(1320000));
    const after = contract.contractForMatch(m.id)!;
    const q = latest(m.id) as Quote;
    expect(after.quote_id).toBe(q.id);
    expect(after.amount).toBe(q.total);
    expect(after.customer_agreed_at).toBeNull();
    expect(after.terms_hash).not.toBe(before.terms_hash);
    expect(() => contract.agreeTerms(ctxFor(m.id, customer), customer.id, before.terms_hash)).toThrow();
  });

  it("both agreeing is not 契約成立: contacts stay locked and work cannot start", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    const c = contract.contractForMatch(m.id)!;
    contract.agreeTerms(ctxFor(m.id, co), co.id, c.terms_hash);
    const r = contract.agreeTerms(ctxFor(m.id, customer), customer.id, c.terms_hash);
    expect(r.agreed).toBe(true);
    const agreed = contract.contractForMatch(m.id)!;
    expect(agreed.stage).toBe("agreed");
    expect(agreed.contract_date).toBeNull();
    expect(contract.contactsUnlocked(m.id)).toBe(false);
    expect(contract.contractContactsFor(agreed, { side: "customer", userId: customer.id })).toBeNull();
    expect(() => contract.saveContractContact(ctxFor(m.id, customer), customer.id, { name: "山田", phone: "090-1234-5678", email: "", address: "", hours: "" })).toThrow();
    expect(() => services.postMessage(ctxFor(m.id, customer), customer.id, { kind: "text", body: "電話は090-1234-5678です" })).toThrow(CONTACT_BLOCK_MESSAGE);
    expect(() => contract.saveTerms(ctxFor(m.id, co), co.id, terms)).toThrow();
    expect(() => services.submitQuote(ctxFor(m.id, co), co.id, quoteInput(1500000))).toThrow();
    expect(() => services.advanceContract(agreed, "in_progress", "test")).toThrow(/契約成立/);
    expect(contract.establishmentChecks(agreed).filter((x) => !x.ok).map((x) => x.key)).toEqual(["document", "customer_doc", "company_doc"]);
  });

  it("契約成立 needs a registered document that both sides confirmed by hash; replacing it resets the confirmations", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    // Only the company registers; nothing to confirm before a document exists.
    expect(() => contract.attachContractDocument(ctxFor(m.id, customer), customer.id, { id: "file_x", sha256: "a".repeat(64) })).toThrow();
    expect(() => contract.confirmContractDocument(ctxFor(m.id, customer), customer.id, "a".repeat(64))).toThrow(/登録されていません/);
    contract.attachContractDocument(ctxFor(m.id, co), co.id, { id: mkFile("file_doc1"), sha256: "a".repeat(64) });
    expect(() => contract.confirmContractDocument(ctxFor(m.id, customer), customer.id, "b".repeat(64))).toThrow(/差し替え/);
    contract.confirmContractDocument(ctxFor(m.id, customer), customer.id, "a".repeat(64));
    // The company swaps the file: the customer's confirmation no longer counts.
    contract.attachContractDocument(ctxFor(m.id, co), co.id, { id: mkFile("file_doc2"), sha256: "c".repeat(64) });
    let c = contract.contractForMatch(m.id)!;
    expect(c.customer_doc_confirmed_at).toBeNull();
    expect(contract.confirmContractDocument(ctxFor(m.id, co), co.id, "c".repeat(64)).established).toBe(false);
    // Double tap / retry
    contract.confirmContractDocument(ctxFor(m.id, co), co.id, "c".repeat(64));
    expect(contract.confirmContractDocument(ctxFor(m.id, customer), customer.id, "c".repeat(64)).established).toBe(true);
    c = contract.contractForMatch(m.id)!;
    expect(c.stage).toBe("contracted");
    expect(c.established_at).not.toBeNull();
    expect(c.contract_date).not.toBeNull();
    const events = contract.contractHistory(c.id).map((e) => e.action);
    expect(events.filter((a) => a === "contract_established")).toHaveLength(1);
    expect(events.filter((a) => a === "document_confirmed")).toHaveLength(3);
    expect(() => contract.attachContractDocument(ctxFor(m.id, co), co.id, { id: mkFile("file_doc3"), sha256: "d".repeat(64) })).toThrow(/差し替えられません/);
  });

  it("after 契約成立, contacts go through the contract form only; chat still refuses them; viewing is logged", () => {
    const m = matches[0];
    const co = owner(m.company_id);
    const c = contract.contractForMatch(m.id)!;
    expect(() => services.postMessage(ctxFor(m.id, customer), customer.id, { kind: "text", body: "電話は090-1234-5678です" })).toThrow(contract.CONTACT_USE_FORM_MESSAGE);
    expect(() => contract.saveContractContact(ctxFor(m.id, customer), customer.id, { name: "山田", phone: "", email: "", address: "", hours: "" })).toThrow(/どちらか/);
    expect(() => contract.saveContractContact(ctxFor(m.id, customer), customer.id, { name: "山田", phone: "12", email: "", address: "", hours: "" })).toThrow(/形式/);
    contract.saveContractContact(ctxFor(m.id, customer), customer.id, { name: "山田 太郎", phone: "０９０-１２３４-５６７８", email: "", address: "藤沢市", hours: "" });
    const before = db.get<{ n: number }>("SELECT COUNT(*) n FROM contact_access_log WHERE contract_id = ?", c.id)!.n;
    const seen = contract.contractContactsFor(contract.contractForMatch(m.id)!, { side: "company", userId: co.id })!;
    expect(seen.theirs?.phone).toBe("090-1234-5678");
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM contact_access_log WHERE contract_id = ?", c.id)!.n).toBe(before + 1);
    // The history says contacts changed, never what they are.
    const ev = contract.contractHistory(c.id).filter((e) => e.action === "contact_updated");
    expect(ev).toHaveLength(1);
    expect(ev[0].detail).not.toContain("090");
    // Another company's staff cannot get at this contract at all.
    expect(matchForUser(m.id, owner(matches[1].company_id))).toBeNull();
    services.advanceContract(contract.contractForMatch(m.id)!, "in_progress", "test");
    expect(contract.verifyContractHistory(c.id)).toBe(true);
  });

  it("detects a tampered history row", () => {
    const c = contract.contractForMatch(matches[0].id)!;
    db.run("UPDATE contract_events SET detail = 'edited' WHERE contract_id = ? AND seq = 1", c.id);
    expect(contract.verifyContractHistory(c.id)).toBe(false);
  });

  it("seeded demo contracts in progress or completed went through every step, with a valid history", () => {
    const rows = db.all<import("../types").Contract>("SELECT * FROM contracts WHERE status IN ('in_progress','completed') AND match_id != ?", matches[0].id);
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r.stage).toBe("contracted");
      expect(contract.establishmentChecks(r).every((x) => x.ok)).toBe(true);
      expect(contract.verifyContractHistory(r.id)).toBe(true);
    }
  });

  it("a contract that started work before these rules is not treated as 契約成立", () => {
    const legacy = { stage: "selected", status: "in_progress" } as const;
    expect(contract.effectiveStage(legacy)).toBe("agreed");
  });
});
