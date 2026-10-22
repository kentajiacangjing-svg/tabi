// Sharing the demo through a Cloudflare Quick Tunnel: refuses without the site password, never carries mail/AI settings.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error plain .mjs script helper without types
import { planDemoShare, tunnelCommand } from "../../../scripts/demo-share-lib.mjs";

const GATE = "tester:correct-horse-battery";
const clean = { exists: true, hasRealData: false, users: { real: 0 } };

describe("demo share", () => {
  it("requires a strong site password and demo mode", () => {
    expect(planDemoShare({}, clean).errors.join()).toContain("SITE_BASIC_AUTH が未設定");
    expect(planDemoShare({ SITE_BASIC_AUTH: "a:short" }, clean).errors.join()).toContain("12文字以上");
    expect(planDemoShare({ SITE_BASIC_AUTH: "a:sumatch123sumatch123" }, clean).errors.join()).toContain("デモ用パスワード");
    expect(planDemoShare({ SITE_BASIC_AUTH: GATE, DEMO_MODE: "false" }, clean).errors.join()).toContain("DEMO_MODE=false");
    expect(planDemoShare({ SITE_BASIC_AUTH: GATE }, clean).errors).toEqual([]);
  });

  it("starts the app with sample data only, nothing sent outside, on localhost", () => {
    const plan = planDemoShare(
      { SITE_BASIC_AUTH: GATE, ANTHROPIC_API_KEY: "x", AI_DRAFT_ENABLED: "true", MAIL_TRANSPORT: "mock", ADMIN_PASSWORD: "x" },
      { exists: false },
    );
    expect(plan.host).toBe("127.0.0.1");
    expect(plan.port).toBe(3100);
    expect(plan.env).toMatchObject({ DEMO_MODE: "true", MAIL_TRANSPORT: "none", ROBOTS_NOINDEX: "true", STORAGE_DIR: "./storage-demo", CLIENT_IP_HEADER: "cf-connecting-ip", REALTIME_STREAM: "off", SITE_BASIC_AUTH: GATE });
    for (const k of ["ANTHROPIC_API_KEY", "AI_DRAFT_ENABLED", "ADMIN_PASSWORD"]) expect(plan.env[k]).toBeUndefined();
  });

  it("stops when the database holds accounts that are not sample data, unless confirmed", () => {
    const withAccounts = { exists: true, hasRealData: true, users: { real: 2 } };
    expect(planDemoShare({ SITE_BASIC_AUTH: GATE }, withAccounts).errors.join()).toContain("--allow-test-accounts");
    const ok = planDemoShare({ SITE_BASIC_AUTH: GATE }, withAccounts, { allowAccounts: true });
    expect(ok.errors).toEqual([]);
    expect(ok.warnings.join()).toContain("2 件");
  });

  it("prints the tunnel command with the email gate when addresses are given", () => {
    expect(tunnelCommand(3100)).toBe("cloudflared tunnel --url http://127.0.0.1:3100");
    expect(tunnelCommand(3100, "a@example.com, *@example.org")).toBe(
      "cloudflared tunnel --url http://127.0.0.1:3100 --allowed-mail 'a@example.com' --allowed-mail '*@example.org'",
    );
  });

  it("the launcher refuses to start without SITE_BASIC_AUTH", () => {
    const storage = fs.mkdtempSync(path.join(os.tmpdir(), "sumatch-share-"));
    const env: NodeJS.ProcessEnv = { ...process.env, STORAGE_DIR: storage, NODE_NO_WARNINGS: "1" };
    delete env.SITE_BASIC_AUTH;
    const r = spawnSync(process.execPath, [path.resolve("scripts/demo-share.mjs")], { env, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("SITE_BASIC_AUTH が未設定");
  });
});
