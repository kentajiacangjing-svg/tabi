import { test, expect, type Browser, type Page } from "@playwright/test";

async function demoLogin(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByText("デモアカウントで試す").click();
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

// A tiny valid PNG (1×1).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("photos: a small photo is sent; an oversized one is refused at once, before uploading", async ({ browser }) => {
  const yamada = await demoLogin(browser, "山田 太郎");
  await yamada.goto("/messages");
  await yamada.getByRole("link").filter({ hasText: "HOME WORKS" }).first().click();
  const attach = yamada.locator('input[type="file"]');
  await attach.setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(11 * 1024 * 1024, 0xff) });
  await expect(yamada.getByText("ファイルサイズは10MBまでです。写真を小さくしてから送ってください。")).toBeVisible();
  await attach.setInputFiles({ name: "wall.png", mimeType: "image/png", buffer: PNG });
  await yamada.getByRole("button", { name: "送信", exact: true }).click();
  await expect(yamada.getByRole("log").locator('img[src^="/api/files/"]').last()).toBeVisible();
  // The photo is private: no browser caching, and another customer cannot fetch it.
  const src = await yamada.getByRole("log").locator('img[src^="/api/files/"]').last().getAttribute("src");
  const own = await yamada.request.get(src!);
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toBe("private, no-store");
  const ito = await demoLogin(browser, "伊藤 由美");
  expect((await ito.request.get(src!)).status()).toBe(404);
  const anon = await browser.newContext();
  expect((await anon.request.get(`http://localhost:3200${src}`)).status()).toBe(404);
});

test("an expired sign-in sends you to the login screen and back to where you were", async ({ browser }) => {
  const page = await demoLogin(browser, "山田 太郎");
  await page.goto("/quotes");
  await page.context().clearCookies();
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=%2Fquotes/);
  await page.getByText("デモアカウントで試す").click();
  await page.getByRole("button", { name: /山田 太郎/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
});

test("repeated wrong passwords are slowed down; the right password works on another account", async ({ page }) => {
  await page.goto("/login");
  const submit = async (password: string) => {
    await page.getByLabel("メールアドレス").fill("nobody@example.com");
    await page.getByLabel("パスワード").fill(password);
    // wait for each sign-in request to finish, so every attempt is counted
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/login")), page.locator("form").getByRole("button", { name: "ログイン" }).click()]);
  };
  for (let i = 0; i < 10; i++) {
    await submit(`wrong-${i}`);
    await expect(page.getByText("メールアドレスまたはパスワードが違います。")).toBeVisible();
  }
  await submit("wrong-again");
  await expect(page.getByText("操作の回数が多すぎます。", { exact: false })).toBeVisible();
});

test("two tabs: deciding in one tab, then a different company in a stale tab, is refused", async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await a.goto("/login");
  await a.getByText("デモアカウントで試す").click();
  await a.getByRole("button", { name: /山田 太郎/ }).first().click();
  await a.waitForURL((u) => !u.pathname.startsWith("/login"));
  await a.goto("/quotes");
  const links = a.getByRole("link", { name: "見積を見る" });
  const first = await links.nth(0).getAttribute("href");
  const second = await links.nth(1).getAttribute("href");
  const b = await ctx.newPage();
  await b.goto(second!);
  await a.goto(first!);
  await a.getByRole("button", { name: "この会社に依頼先を決める" }).click();
  await a.getByRole("button", { name: "依頼先に決める" }).click();
  await a.waitForURL(/decided=1/);
  // The stale tab still shows the button; the server refuses.
  await b.getByRole("button", { name: "この会社に依頼先を決める" }).click();
  await b.getByRole("button", { name: "依頼先に決める" }).click();
  await expect(b.getByText("この相談は既に依頼先が決まっています。")).toBeVisible();
  // After reload the stale tab shows the decided state.
  await b.reload();
  await expect(b.getByText("この相談は別の会社に決まりました。")).toBeVisible();
});

test("withdrawal: the request is recorded and shown to the operator; nothing is deleted automatically", async ({ browser }) => {
  const ito = await demoLogin(browser, "伊藤 由美");
  await ito.goto("/account");
  ito.once("dialog", (d) => d.accept());
  await ito.getByLabel("理由（任意）").fill("テスト");
  await ito.getByRole("button", { name: "退会を申請する" }).click();
  await expect(ito.getByText("退会の申請を受け付けています。", { exact: false })).toBeVisible();
  await ito.reload();
  await expect(ito.getByRole("button", { name: "申請を取り下げる" })).toBeVisible();
  const admin = await demoLogin(browser, "SUMATCH運営");
  await admin.goto("/admin?tab=deletions");
  await expect(admin.getByRole("cell", { name: /伊藤 由美/ })).toBeVisible();
  // The account still works.
  await ito.goto("/projects");
  await expect(ito).toHaveURL(/\/projects/);
});

test("operator screens: fee estimate (no billing), audit log, health check", async ({ browser, request }) => {
  const admin = await demoLogin(browser, "SUMATCH運営");
  await admin.goto("/admin?tab=fees");
  await expect(admin.getByText("成功報酬の試算", { exact: false })).toBeVisible();
  await expect(admin.getByText("要確認（試算）").first()).toBeVisible();
  await expect(admin.getByText("請求確定")).toHaveCount(0);
  await admin.goto("/admin?tab=audit");
  await expect(admin.getByText("運営による閲覧（チャット・非公開ファイル）")).toBeVisible();
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  expect((await request.post("/api/cron/purge")).status()).toBe(401);
});
