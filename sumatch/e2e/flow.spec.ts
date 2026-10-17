import { test, expect, type Browser, type Page } from "@playwright/test";
import zlib from "node:zlib";

// A tiny valid PNG (1x1) built at runtime, used as a "photo".
function png(): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const idat = zlib.deflateSync(Buffer.from([0, 200, 210, 230]));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

async function demoLogin(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByText("デモアカウントで試す").click();
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("customer → company → chat → quote → compare → decide", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Top: one question, pick a category, 次へ
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "どんな工事？" })).toBeVisible();
  await page.getByRole("radio", { name: /外壁・屋根/ }).click();
  await page.getByRole("button", { name: "次へ" }).click();

  // 2. One decision per screen, thin progress bar, one button at the bottom
  await expect(page.getByRole("heading", { name: "予算は？" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.getByRole("radio", { name: "100〜200万円" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "いつ頃？" })).toBeVisible();
  await page.getByRole("radio", { name: "3ヶ月以内" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "場所は？" })).toBeVisible();
  await page.getByRole("radio", { name: "藤沢市" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "この条件で探します" })).toBeVisible();
  await page.getByRole("button", { name: "条件に合う会社を探す" }).click();
  await page.getByLabel(/お名前/).fill("テスト 花子");
  await page.getByLabel(/メールアドレス/).fill(email);
  await page.getByLabel(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "登録して会社を見る" }).click();

  // 3. Company discovery: one at a time; consult 湘南ペイント, save the others
  await page.waitForURL(/\/matches\?project=/);
  const projectUrl = page.url();
  for (let i = 0; i < 6; i++) {
    const name = await page.getByRole("heading", { level: 2 }).first().textContent();
    if (name?.includes("湘南ペイント")) break;
    await page.getByRole("button", { name: /保存/ }).click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByRole("heading", { name: "湘南ペイント" })).toBeVisible();
  await expect(page.getByRole("link", { name: "詳しく見る" })).toBeVisible();
  await page.getByRole("button", { name: /相談したい/ }).click();
  await expect(page.getByText("湘南ペイントに相談を送りました")).toBeVisible();

  // 4. Company: one lead at a time → 対応したい → match moment → chat
  const biz = await demoLogin(browser, "湘南ペイント");
  await biz.goto("/business/leads");
  await expect(biz.getByText("お客様が相談を希望しています")).toBeVisible();
  await expect(biz.getByText("藤沢市").first()).toBeVisible();
  await biz.getByRole("button", { name: "対応したい" }).click();
  await biz.waitForURL(/\/business\/match\//);
  await expect(biz.getByRole("heading", { name: "マッチしました" })).toBeVisible();
  await biz.getByRole("link", { name: "メッセージを送る" }).click();
  await biz.waitForURL(/\/business\/messages\//);

  // contact-info warning
  await biz.getByLabel("メッセージ").fill("詳しくは 090-1234-5678 までお電話ください");
  await biz.getByRole("button", { name: "送信", exact: true }).click();
  await expect(biz.getByText(/電話番号が含まれているようです/)).toBeVisible();
  await biz.getByRole("button", { name: "修正する" }).click();
  await biz.getByLabel("メッセージ").fill("ご相談ありがとうございます。現地調査の候補日を教えてください。");
  await biz.getByRole("button", { name: "送信", exact: true }).click();
  await expect(biz.locator("section").getByText("現地調査の候補日を教えてください。", { exact: false }).last()).toBeVisible();

  // 5. Company submits a quote
  await biz.getByRole("link", { name: "見積を作る" }).click();
  await biz.getByLabel("工事項目").first().fill("外壁塗装一式");
  await biz.getByLabel("単価").first().fill("1000000");
  await biz.locator('input[name="warranty_years"]').fill("10");
  await biz.locator('input[name="duration_days"]').fill("14");
  await biz.getByRole("button", { name: "見積を提出" }).click();
  await biz.waitForURL(/\/business\/messages\//);
  await expect(biz.locator("section").getByText("¥1,100,000").first()).toBeVisible();
  // business home and case list reflect it
  await biz.goto("/business/dashboard");
  await expect(biz.getByRole("heading", { name: "今日やること" })).toBeVisible();
  await biz.goto("/business/active");
  await expect(biz.getByText("テスト 花子").first()).toBeVisible();

  // 6. Customer: notification → match moment, chat, compare, decide
  await page.goto("/projects");
  await page.getByRole("link", { name: /湘南ペイントと相談を始められます/ }).click();
  await expect(page.getByRole("heading", { name: "マッチしました" })).toBeVisible();
  await page.getByRole("link", { name: "メッセージを送る" }).click();
  await expect(page.locator("section").getByText("現地調査の候補日を教えてください。", { exact: false }).last()).toBeVisible();
  await page.goto(projectUrl.replace("/matches?project=", "/quotes?project="));
  await expect(page.getByRole("heading", { name: "見積を比べる" })).toBeVisible();
  await expect(page.getByText("¥1,100,000").first()).toBeVisible();
  await page.getByRole("link", { name: "見積を見る" }).first().click();
  await page.getByRole("button", { name: "この会社に決める" }).click();
  await page.getByRole("button", { name: "決定する" }).click();
  await page.waitForURL(/\/projects\/.+decided=1/);
  await expect(page.getByRole("heading", { name: "契約" })).toBeVisible();
  await expect(page.getByText("1,100,000円")).toBeVisible();

  // 7. Admin: funnel and the new contract
  const admin = await demoLogin(browser, "SUMATCH運営");
  await admin.goto("/admin?tab=analytics");
  await expect(admin.getByText("会社閲覧")).toBeVisible();
  await admin.goto("/admin?tab=contracts");
  await expect(admin.getByText("テスト 花子")).toBeVisible();
});

test("saved companies can be consulted later", async ({ browser }) => {
  const watanabe = await demoLogin(browser, "伊藤 由美");
  await watanabe.goto("/matches");
  await watanabe.getByRole("button", { name: /保存/ }).click();
  await expect(watanabe.getByText(/を保存しました/)).toBeVisible();
  await watanabe.goto("/saved");
  await expect(watanabe.getByRole("heading", { name: "保存した会社" })).toBeVisible();
  await expect(watanabe.getByRole("button", { name: "相談したい" }).first()).toBeVisible();
});

test("access control: customers cannot open other people's chats or business pages", async ({ browser }) => {
  const ito = await demoLogin(browser, "伊藤 由美");
  const res = await ito.goto("/messages/mt_does_not_exist");
  expect(res?.status()).toBe(404);
  await ito.goto("/business/dashboard");
  await expect(ito).toHaveURL(/\/projects$/);
  await ito.goto("/admin");
  await expect(ito).toHaveURL(/\/projects$/);
  const file = await ito.request.get("/api/files/file_nope");
  expect(file.status()).toBe(404);
});

test("anonymous users are sent to login", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects/);
});

test("question flow: browser back keeps answers, missing answers get a short message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByText("工事の種類を選んでください")).toBeVisible();
  await page.getByRole("radio", { name: /外壁・屋根/ }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("radio", { name: "100〜200万円" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "いつ頃？" })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByText("時期を選んでください")).toBeVisible();

  // phone back gesture → previous question, answer still selected
  await page.goBack();
  await expect(page.getByRole("heading", { name: "予算は？" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "100〜200万円" })).toHaveAttribute("aria-checked", "true");
  // forward again, then the in-app back arrow does the same
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("radio", { name: "3ヶ月以内" }).click();
  await page.getByRole("button", { name: "戻る" }).click();
  await expect(page.getByRole("heading", { name: "予算は？" })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("radio", { name: "3ヶ月以内" })).toHaveAttribute("aria-checked", "true");
});

test("unknown pages show a friendly 404 with a way back", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "ページが見つかりません" })).toBeVisible();
  await expect(page.getByRole("link", { name: "トップへ戻る" })).toBeVisible();
});

test("a message sent with a double keypress arrives once", async ({ browser }) => {
  const biz = await demoLogin(browser, "湘南ペイント");
  await biz.goto("/business/messages");
  await biz.locator("main a[href^='/business/messages/']").first().click();
  await biz.waitForURL(/\/business\/messages\/.+/);
  const text = `二重送信チェック ${Date.now()}`;
  await biz.getByLabel("メッセージ").fill(text);
  await biz.getByLabel("メッセージ").press("Control+Enter");
  await biz.getByLabel("メッセージ").press("Control+Enter");
  await expect(biz.locator("section").getByText(text)).toHaveCount(1);
  await biz.waitForTimeout(800);
  await expect(biz.locator("section").getByText(text)).toHaveCount(1);
});
