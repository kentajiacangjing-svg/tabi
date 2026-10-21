// 成功報酬の内部台帳 (provisional) and the operator's review lists.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-fees-"));
process.env.STORAGE_DIR = dir;

describe("fee ledger and review lists", async () => {
  const db = await import("../db");
  const fees = await import("../fees");
  type Contract = import("../types").Contract;
  const adminId = () => db.get<{ id: string }>("SELECT id FROM users WHERE role = 'admin'")!.id;

  beforeAll(() => {
    db.db();
  });

  it("every 契約成立 has exactly one record, starting as 要確認, computed from the contract amount and plan rate", () => {
    const established = db.all<Contract>("SELECT * FROM contracts WHERE stage = 'contracted'");
    expect(established.length).toBe(2);
    for (const c of established) {
      const f = db.get<import("../fees").FeeRecord>("SELECT * FROM fee_records WHERE contract_id = ?", c.id)!;
      expect(f).toMatchObject({ base_amount: c.amount, rate: c.success_fee_rate, fee_amount: Math.round(c.amount * c.success_fee_rate), status: "pending_review", rule_version: "draft-1" });
      fees.recordFeeForContract(c); // a second call changes nothing
    }
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM fee_records")!.n).toBe(2);
    // Chosen-but-not-established contracts have none.
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM fee_records f JOIN contracts c ON c.id = f.contract_id WHERE c.stage != 'contracted'")!.n).toBe(0);
  });

  it("only allowed status changes, with a reason for 対象外 / 差戻し, each one logged", () => {
    const f = db.get<{ id: string }>("SELECT id FROM fee_records LIMIT 1")!;
    expect(() => fees.setFeeStatus(f.id, "paid", adminId(), "")).toThrow(/変更できません/);
    expect(() => fees.setFeeStatus(f.id, "void", adminId(), "")).toThrow(/理由/);
    fees.setFeeStatus(f.id, "confirmed", adminId(), "");
    fees.setFeeStatus(f.id, "invoiced", adminId(), "11月分");
    fees.setFeeStatus(f.id, "paid", adminId(), "");
    expect(fees.allowedFeeTransitions("paid")).toEqual([]);
    expect(db.all<{ to_status: string }>("SELECT to_status FROM fee_events WHERE fee_id = ? ORDER BY created_at", f.id).map((e) => e.to_status)).toEqual(["confirmed", "invoiced", "paid"]);
  });

  it("review lists show signals only: legacy contracts, stalled decisions, conversations gone quiet after a block", () => {
    // A contract that started work before documents existed (simulated), untouched by the app.
    const c = db.get<Contract>("SELECT * FROM contracts WHERE stage = 'contracted' AND status = 'completed'")!;
    db.run("UPDATE contracts SET stage = 'selected' WHERE id = ?", c.id);
    const q = fees.reviewQueues();
    expect(q.legacy.map((x) => x.id)).toContain(c.id);
    expect(db.get<{ amount: number; status: string }>("SELECT amount, status FROM contracts WHERE id = ?", c.id)).toEqual({ amount: c.amount, status: "completed" });

    const m = db.get<{ id: string }>("SELECT id FROM matches WHERE status = 'matched' AND id NOT IN (SELECT match_id FROM contracts) LIMIT 1")!;
    const old = new Date(Date.now() - 20 * 86400_000).toISOString();
    db.insert("contact_blocks", { id: db.newId("cb"), match_id: m.id, sender_user_id: null, sender_side: "customer", flags: "phone", source: "message", created_at: old });
    db.run("UPDATE matches SET last_message_at = ? WHERE id = ?", old, m.id);
    expect(fees.reviewQueues().quietAfterBlock.map((x) => x.match_id)).toContain(m.id);
    // A later message takes it off the list.
    db.run("UPDATE matches SET last_message_at = ? WHERE id = ?", new Date().toISOString(), m.id);
    expect(fees.reviewQueues().quietAfterBlock.map((x) => x.match_id)).not.toContain(m.id);
  });
});
