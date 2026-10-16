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
});
