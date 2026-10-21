// Two or more separate processes (like two server instances) acting on the same contract at the same moment.
// The database file is shared; each process has its own connection.
import { describe, it, expect, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-mp-"));
process.env.STORAGE_DIR = dir;
const worker = path.resolve("src/lib/__tests__/workers/contract-worker.ts");
const viteNode = path.resolve("node_modules/.bin/vite-node");

function run(args: object): Promise<{ ok: boolean; error?: string; r?: unknown }> {
  return new Promise((resolve, reject) => {
    const p = spawn(viteNode, [worker, "--", JSON.stringify(args)], { env: { ...process.env, STORAGE_DIR: dir, NODE_NO_WARNINGS: "1" } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", () => {
      const line = out.split("\n").find((l) => l.startsWith("RESULT"));
      if (!line) return reject(new Error(`worker failed: ${err || out}`));
      resolve(JSON.parse(line.slice(6)));
    });
  });
}

describe("separate processes writing at the same moment", async () => {
  const db = await import("../db");
  const contract = await import("../contract");
  const { matchForUser } = await import("../access");
  type User = import("../types").User;
  const user = (email: string) => db.get<User>("SELECT * FROM users WHERE email = ?", email)!;
  const owner = (companyId: string) => db.get<User>("SELECT u.* FROM users u JOIN company_members m ON m.user_id = u.id WHERE m.company_id = ? AND m.member_role = 'owner'", companyId)!;
  let customer: User;
  let matchId: string;
  let co: User;

  beforeAll(() => {
    db.db();
    customer = user("yamada@demo.sumatch.jp");
    const m = db.get<{ id: string; company_id: string }>("SELECT m.id, m.company_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE p.customer_id = ? AND m.status = 'matched' ORDER BY m.score DESC LIMIT 1", customer.id)!;
    matchId = m.id;
    co = owner(m.company_id);
  });

  it("deciding from three processes at once records one decision", async () => {
    const quote = contract.latestQuoteForMatch(matchId)!;
    const startAt = Date.now() + 2500;
    const rs = await Promise.all([0, 1, 2].map(() => run({ op: "decide", matchId, userId: customer.id, quoteId: quote.id, startAt })));
    expect(rs.every((r) => r.ok)).toBe(true);
    const c = contract.contractForMatch(matchId)!;
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM contracts WHERE project_id = ?", c.project_id)!.n).toBe(1);
    expect(contract.contractHistory(c.id).filter((e) => e.action === "selected")).toHaveLength(1);
  });

  it("both sides agreeing at once (plus a duplicate) reaches 双方の合意 exactly once", async () => {
    const ctx = matchForUser(matchId, co)!;
    const { hash } = contract.saveTerms(ctx, co.id, {
      scope: "外壁", start_date: "2026-12-01", duration: "14日", materials: "シリコン", payment_terms: "完工後", extra_work: "事前見積", warranty: "10年", cancellation: "着工前無償",
    });
    const startAt = Date.now() + 2500;
    const rs = await Promise.all([
      run({ op: "agree", matchId, userId: customer.id, hash, startAt }),
      run({ op: "agree", matchId, userId: co.id, hash, startAt }),
      run({ op: "agree", matchId, userId: customer.id, hash, startAt }),
    ]);
    expect(rs.every((r) => r.ok)).toBe(true);
    const c = contract.contractForMatch(matchId)!;
    expect(c.stage).toBe("agreed");
    const ev = contract.contractHistory(c.id);
    expect(ev.filter((e) => e.action === "both_agreed")).toHaveLength(1);
    expect(ev.filter((e) => e.action === "agreed")).toHaveLength(2);
    expect(contract.verifyContractHistory(c.id)).toBe(true);
  });

  it("both sides confirming the document at once (plus duplicates) records 契約成立 exactly once", async () => {
    db.insert("files", { id: "file_mp", owner_user_id: co.id, scope: "contract", scope_id: null, mime: "application/pdf", size: 1, original_name: "k.pdf", storage_path: "k.pdf", created_at: db.now() });
    contract.attachContractDocument(matchForUser(matchId, co)!, co.id, { id: "file_mp", sha256: "e".repeat(64) });
    const startAt = Date.now() + 2500;
    const rs = await Promise.all([
      run({ op: "confirm", matchId, userId: customer.id, hash: "e".repeat(64), startAt }),
      run({ op: "confirm", matchId, userId: co.id, hash: "e".repeat(64), startAt }),
      run({ op: "confirm", matchId, userId: customer.id, hash: "e".repeat(64), startAt }),
      run({ op: "confirm", matchId, userId: co.id, hash: "e".repeat(64), startAt }),
    ]);
    expect(rs.every((r) => r.ok)).toBe(true);
    const c = contract.contractForMatch(matchId)!;
    expect(c.stage).toBe("contracted");
    const ev = contract.contractHistory(c.id);
    expect(ev.filter((e) => e.action === "contract_established")).toHaveLength(1);
    expect(ev.filter((e) => e.action === "document_confirmed")).toHaveLength(2);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM fee_records WHERE contract_id = ?", c.id)!.n).toBe(1);
    expect(contract.verifyContractHistory(c.id)).toBe(true);
  });

  it("the database itself refuses a second 契約成立 record", () => {
    const c = contract.contractForMatch(matchId)!;
    expect(() => contract.appendContractEvent(c.id, "system", null, "contract_established", c.terms_hash)).toThrow(/UNIQUE/);
  });
});
