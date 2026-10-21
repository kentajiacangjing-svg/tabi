import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-test-"));
process.env.STORAGE_DIR = dir;

describe("seed + domain flow", async () => {
  const db = await import("../db");
  const services = await import("../services");
  type M = import("../types").Match;

  beforeAll(() => {
    db.db();
  });

  it("seeds the demo scenario", () => {
    const yamada = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'yamada@demo.sumatch.jp'")!;
    const quotes = db.all<{ total: number; name: string }>(
      `SELECT q.total, c.name FROM quotes q JOIN companies c ON c.id = q.company_id JOIN projects p ON p.id = q.project_id
        WHERE p.customer_id = ? ORDER BY q.total`,
      yamada.id,
    );
    expect(quotes.map((q) => q.total)).toEqual([1180000, 1320000, 1450000]);
    const scores = db.all<{ score: number }>(
      "SELECT m.score FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' ORDER BY m.score DESC",
      yamada.id,
    );
    expect(scores.map((s) => s.score)).toEqual([94, 89, 85]);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM companies")!.n).toBe(10);
  });

  it("forms a match only when both sides say yes, and enforces the 3-company limit", () => {
    const ito = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'ito@demo.sumatch.jp'")!;
    const project = db.get<{ id: string }>("SELECT id FROM projects WHERE customer_id = ?", ito.id)!;
    const cands = db.all<M>("SELECT * FROM matches WHERE project_id = ? ORDER BY score DESC", project.id);
    expect(cands.length).toBeGreaterThanOrEqual(3);
    const first = services.customerRequest(cands[0].id, ito.id);
    expect(first.status).toBe("candidate");
    const after = services.companyRespond(project.id, cands[0].company_id, true);
    expect(after.status).toBe("matched");
    const sys = db.get<{ n: number }>("SELECT COUNT(*) n FROM messages WHERE match_id = ? AND kind = 'system'", after.id)!;
    expect(sys.n).toBe(1);
    // Other user cannot request on this project
    const yamada = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'yamada@demo.sumatch.jp'")!;
    expect(() => services.customerRequest(cands[1].id, yamada.id)).toThrow();
  });
});

describe("save / pass", async () => {
  const db = await import("../db");
  const services = await import("../services");
  type M = import("../types").Match;
  it("saving, passing and then consulting keep the flags consistent", () => {
    const watanabe = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'watanabe@demo.sumatch.jp'")!;
    const project = db.get<{ id: string }>("SELECT id FROM projects WHERE customer_id = ?", watanabe.id)!;
    const m = db.get<M>("SELECT * FROM matches WHERE project_id = ? AND customer_interest = 0 LIMIT 1", project.id)!;
    services.customerMark(m.id, watanabe.id, "save");
    expect(db.get<M>("SELECT * FROM matches WHERE id = ?", m.id)!.customer_saved).toBe(1);
    services.customerMark(m.id, watanabe.id, "pass");
    const passed = db.get<M>("SELECT * FROM matches WHERE id = ?", m.id)!;
    expect([passed.customer_saved, passed.customer_passed]).toEqual([0, 1]);
    services.customerRequest(m.id, watanabe.id);
    expect(db.get<M>("SELECT * FROM matches WHERE id = ?", m.id)!.customer_passed).toBe(0);
    const other = db.get<{ id: string }>("SELECT id FROM users WHERE email = 'ito@demo.sumatch.jp'")!;
    expect(() => services.customerMark(m.id, other.id, "save")).toThrow();
  });

  it("every screen's amount comes from one place: stored totals equal the calculation, latest versions agree", async () => {
    const { calcQuote } = await import("../quote-calc");
    const { latestQuotesForProject } = await import("../queries");
    const { latestQuoteForMatch } = await import("../contract");
    const quotes = db.all<import("../types").Quote>("SELECT * FROM quotes");
    for (const q of quotes) {
      const items = db.all<{ name: string; quantity: number; unit: string; unit_price: number; amount: number }>("SELECT * FROM quote_items WHERE quote_id = ?", q.id);
      const calc = calcQuote(items, q.overhead, q.discount);
      expect(calc.total).toBe(q.total);
      expect(calc.tax).toBe(q.tax);
      expect(items.map((i) => i.amount)).toEqual(calc.lines.map((l) => l.amount));
    }
    // The comparison list and the decide/contract logic pick the same version for each company.
    for (const p of db.all<{ id: string }>("SELECT id FROM projects")) {
      for (const q of latestQuotesForProject(p.id).filter((x) => x.status !== "declined")) {
        expect(latestQuoteForMatch(q.match_id)?.id).toBe(q.id);
      }
    }
    // A contract's amount is its quote's total.
    for (const c of db.all<{ amount: number; quote_id: string }>("SELECT amount, quote_id FROM contracts")) {
      expect(c.amount).toBe(db.get<{ total: number }>("SELECT total FROM quotes WHERE id = ?", c.quote_id)!.total);
    }
  });

  it("110万円 and 118万円 in the demo are two different consultations, not one quote shown two ways", async () => {
    const { calcQuote } = await import("../quote-calc");
    // A new customer's e2e quote: 1,000,000円 + 10% tax.
    expect(calcQuote([{ name: "外壁塗装一式", quantity: 1, unit: "式", unit_price: 1000000 }], 0, 0).total).toBe(1100000);
    // 山田 太郎's seeded 湘南ペイント quote is a separate project.
    const q = db.get<{ total: number; version: number }>(
      "SELECT q.total, q.version FROM quotes q JOIN companies c ON c.id = q.company_id JOIN projects p ON p.id = q.project_id JOIN users u ON u.id = p.customer_id WHERE c.name = '湘南ペイント' AND u.email = 'yamada@demo.sumatch.jp'",
    )!;
    expect(q).toEqual({ total: 1180000, version: 1 });
  });
});
