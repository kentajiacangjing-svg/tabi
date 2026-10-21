// Sample vs real data: hidden outside demo mode; backup / restore / reset never lose real data.
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-data-"));
const backups = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-backups-"));
process.env.STORAGE_DIR = dir;

const script = (name: string, args: string[] = [], storage = dir) =>
  spawnSync(process.execPath, [path.resolve("scripts", name), ...args], {
    env: { ...process.env, STORAGE_DIR: storage, BACKUP_DIR: backups, NODE_NO_WARNINGS: "1" },
    encoding: "utf8",
  });
const inspectJson = (storage = dir) => {
  const out = execFileSync(process.execPath, ["-e", `import("${path.resolve("scripts/db-lib.mjs")}").then(m => console.log(JSON.stringify(m.inspect())))`], {
    env: { ...process.env, STORAGE_DIR: storage, NODE_NO_WARNINGS: "1" },
    encoding: "utf8",
  });
  return JSON.parse(out);
};

describe("demo data and data operations", async () => {
  const db = await import("../db");
  const queries = await import("../queries");
  const services = await import("../services");
  const auth = await import("../auth");
  const savedMode = process.env.DEMO_MODE;

  beforeAll(() => {
    db.db();
  });
  afterEach(() => {
    if (savedMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = savedMode;
  });

  it("flags every seeded account and company as sample data", () => {
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE is_demo = 0")!.n).toBe(0);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM companies WHERE is_demo = 0")!.n).toBe(0);
  });

  it("outside demo mode, sample companies are not shown, matched or signed in", () => {
    const company = db.get<{ id: string }>("SELECT id FROM companies WHERE status = 'approved' LIMIT 1")!;
    const project = db.get<import("../types").Project>("SELECT * FROM projects WHERE status = 'consulting' LIMIT 1")!;
    expect(queries.companyProfile(company.id)).not.toBeNull();
    process.env.DEMO_MODE = "false";
    expect(queries.companyProfile(company.id)).toBeNull();
    db.run("DELETE FROM matches WHERE project_id = ? AND status = 'candidate'", project.id);
    expect(services.generateCandidates(project)).toHaveLength(0);
    // A sample account's existing session stops working.
    const user = db.get<{ id: string }>("SELECT id FROM users WHERE is_demo = 1 LIMIT 1")!;
    const token = "t".repeat(43);
    db.insert("sessions", { token_hash: createHash("sha256").update(token).digest("hex"), user_id: user.id, expires_at: "2999-01-01T00:00:00.000Z", created_at: db.now() });
    expect(auth.userFromToken(token)).toBeNull();
    process.env.DEMO_MODE = "true";
    expect(auth.userFromToken(token)?.id).toBe(user.id);
  });

  it("inspect tells demo data from real data without changing anything", () => {
    const before = fs.statSync(path.join(dir, "sumatch.db")).mtimeMs;
    const r = inspectJson();
    expect(r.hasRealData).toBe(false);
    expect(r.users.demo).toBeGreaterThan(0);
    expect(fs.statSync(path.join(dir, "sumatch.db")).mtimeMs).toBe(before);
  });

  it("reset refuses when real data exists, and does nothing without --yes", () => {
    const dry = script("reset-db.mjs");
    expect(dry.status).toBe(0);
    expect(fs.existsSync(path.join(dir, "sumatch.db"))).toBe(true);
    db.insert("users", { id: db.newId("usr"), email: "real-person@example.com", name: "実在 太郎", role: "customer", password_hash: "x", created_at: db.now() });
    expect(inspectJson().hasRealData).toBe(true);
    const r = script("reset-db.mjs", ["--yes"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("実データがあるため中止");
    expect(fs.existsSync(path.join(dir, "sumatch.db"))).toBe(true);
    expect(db.get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE email = 'real-person@example.com'")!.n).toBe(1);
  });

  it("backup → restore into an empty location gives back the same data", () => {
    const b = script("db-backup.mjs", ["test"]);
    expect(b.status).toBe(0);
    const folder = fs.readdirSync(backups).find((f) => f.endsWith("-test"))!;
    const src = path.join(backups, folder);
    const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
    expect(manifest.summary.users.real).toBe(1);

    const target = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-restore-"));
    const dry = script("db-restore.mjs", [src], target);
    expect(dry.status).toBe(0);
    expect(fs.existsSync(path.join(target, "sumatch.db"))).toBe(false);
    const done = script("db-restore.mjs", [src, "--yes"], target);
    expect(done.status).toBe(0);
    const restored = inspectJson(target);
    expect(restored.users).toEqual(inspectJson().users);
    expect(restored.uploads).toBe(manifest.upload_files);

    // A tampered backup is refused.
    fs.appendFileSync(path.join(src, "sumatch.db"), "x");
    const bad = script("db-restore.mjs", [src, "--yes"], target);
    expect(bad.status).toBe(1);
  });
});
