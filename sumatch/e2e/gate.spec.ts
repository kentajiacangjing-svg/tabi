import { test, expect } from "@playwright/test";

// Server 3203: SITE_BASIC_AUTH is on (credentials generated per run in playwright.config.ts).
const GATED = "http://localhost:3203";
const creds = () => process.env.E2E_GATE_CREDENTIALS!;

test("limited test: the site asks for the shared password; with it, pages open and are not indexed", async ({ browser, request }) => {
  const noAuth = await request.get(`${GATED}/`);
  expect(noAuth.status()).toBe(401);
  expect(noAuth.headers()["www-authenticate"]).toContain("Basic");
  const wrong = await request.get(`${GATED}/`, { headers: { authorization: `Basic ${Buffer.from("beta:nope").toString("base64")}` } });
  expect(wrong.status()).toBe(401);
  // The uptime check is reachable without the password and reveals nothing.
  const health = await request.get(`${GATED}/api/health`);
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });

  const [user, password] = creds().split(":");
  const ctx = await browser.newContext({ httpCredentials: { username: user, password } });
  const page = await ctx.newPage();
  const res = await page.goto(`${GATED}/`);
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("heading", { level: 1, name: "どんな工事？" })).toBeVisible();
});

test("sign-in attempts are counted across two server processes", async ({ browser }) => {
  const email = `spread-${Date.now()}@example.com`;
  const tryOn = async (base: string, n: number) => {
    const ctx = await browser.newContext({ baseURL: base });
    const page = await ctx.newPage();
    await page.goto("/login");
    for (let i = 0; i < n; i++) {
      await page.getByLabel("メールアドレス").fill(email);
      await page.getByLabel("パスワード").fill(`wrong-${base}-${i}`);
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), page.locator("form").getByRole("button", { name: "ログイン" }).click()]);
    }
    return page;
  };
  await tryOn("http://localhost:3200", 5);
  const second = await tryOn("http://localhost:3201", 6);
  await expect(second.getByText("操作の回数が多すぎます。", { exact: false })).toBeVisible();
});

test("with REALTIME_STREAM=off (shared through a Quick Tunnel) pages open no event stream; the demo server does", async ({ browser }) => {
  const [user, password] = creds().split(":");
  const ctx = await browser.newContext({ httpCredentials: { username: user, password } });
  const page = await ctx.newPage();
  const streams: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/stream")) streams.push(r.url());
  });
  await page.goto(`${GATED}/signup`);
  await page.getByLabel("お名前（ニックネーム可）").fill("テスト 花子");
  await page.getByLabel("メールアドレス").fill(`nostream-${Date.now()}@example.com`);
  await page.getByLabel("パスワード").fill("test-password-123");
  await page.getByRole("button", { name: "無料で登録する" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"));
  await page.goto(`${GATED}/messages`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(streams).toEqual([]);

  // control: with the stream on, the same screen subscribes to it
  const demo = await (await browser.newContext()).newPage();
  await demo.goto("http://localhost:3200/login");
  await demo.getByText("デモアカウントで試す").click();
  await demo.getByRole("button", { name: /山田 太郎/ }).first().click();
  await demo.waitForURL((u) => !u.pathname.startsWith("/login"));
  await Promise.all([demo.waitForRequest((r) => r.url().includes("/api/stream")), demo.goto("http://localhost:3200/messages")]);
});
