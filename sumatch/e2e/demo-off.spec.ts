import { test, expect } from "@playwright/test";

// Server 3202 runs with DEMO_MODE=false on the same database the demo servers seeded.
const OFF = "http://localhost:3202";

test("with demo mode off, the login screen has no demo sign-in and demo accounts are refused", async ({ page }) => {
  await page.goto(`${OFF}/login`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText("デモアカウントで試す")).toHaveCount(0);
  await page.getByLabel("メールアドレス").fill("yamada@demo.sumatch.jp");
  await page.getByLabel("パスワード").fill("sumatch123");
  await page.locator("form").getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("メールアドレスまたはパスワードが違います。")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("with demo mode off, sample companies are not shown and a demo session from the demo server does not work", async ({ browser }) => {
  // Sign in on the demo server (cookies for localhost are shared between the ports).
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("http://localhost:3200/login");
  await page.getByText("デモアカウントで試す").click();
  await page.getByRole("button", { name: /山田 太郎/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`${OFF}/projects`);
  await expect(page).toHaveURL(/\/login/);

  await page.goto(`${OFF}/`);
  await expect(page.getByText("湘南ペイント")).toHaveCount(0);
  await expect(page.getByText("デモ", { exact: true })).toBeHidden();
  const html = await (await page.request.get(`${OFF}/`)).text();
  expect(html).not.toContain("data-demo=\"\"");
});

test("with demo mode off, a sample company's page is not found", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("http://localhost:3200/login");
  await page.getByText("デモアカウントで試す").click();
  await page.getByRole("button", { name: /山田 太郎/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto("http://localhost:3200/messages");
  await page.getByRole("link").filter({ hasText: "湘南ペイント" }).first().click();
  const href = await page.getByRole("link", { name: "会社詳細" }).getAttribute("href");
  expect(href).toMatch(/^\/company\//);
  expect((await page.request.get(`http://localhost:3200${href}`)).status()).toBe(200);
  expect((await page.request.get(`${OFF}${href}`)).status()).toBe(404);
});
