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
    return (~c >>> 0);
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
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test("customer → company → chat → quote → compare → decide", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Diagnosis as a brand-new visitor
  await page.goto("/");
  await page.getByRole("link", { name: "無料で相談する" }).first().click();
  await expect(page.getByRole("heading", { name: "どんなことでお困りですか？" })).toBeVisible();
  await page.getByRole("button", { name: /外壁塗装/ }).click();
  await page.getByPlaceholder("251-0047").fill("251-0052");
  await expect(page.getByRole("button", { name: "藤沢市" })).toHaveClass(/bg-ink/);
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "戸建て" }).click();
  await page.locator('input[type="number"]').fill("20");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "色あせ" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "100〜150万円" }).click();
  await page.getByRole("button", { name: "3ヶ月以内" }).click();
  await page.getByRole("button", { name: "土日祝" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "wall.png", mimeType: "image/png", buffer: png() });
  await page.getByRole("button", { name: "診断結果を見る" }).click();
  await expect(page.getByText("外壁塗装の一般的な価格帯は")).toBeVisible();
  await expect(page.getByText("正式な金額は現地確認後に変動します。")).toBeVisible();
  await page.getByLabel(/お名前/).fill("テスト 花子");
  await page.getByLabel(/メールアドレス/).fill(email);
  await page.getByLabel(/パスワード/).fill("password123");
  await page.getByRole("button", { name: "条件に合う会社を探す" }).click();

  // 2. Candidates with match score + reasons; ask to talk to 湘南ペイント
  await page.waitForURL(/\/matches\?project=/);
  const card = page.locator("article", { hasText: "湘南ペイント" });
  await expect(card.getByText(/マッチ度 \d+%/)).toBeVisible();
  await expect(card.getByText("マッチ度の理由")).toBeVisible();
  await card.getByRole("button", { name: "この会社と話したい" }).click();
  await expect(card.getByText("会社の返答を待っています")).toBeVisible();
  const projectUrl = page.url();

  // 3. Company accepts → chat opens immediately
  const biz = await demoLogin(browser, "湘南ペイント");
  await biz.goto("/business/leads");
  const lead = biz.locator("article", { hasText: "お客様が話したい" }).filter({ hasText: "築20年" });
  await lead.getByRole("button", { name: "対応したい" }).click();
  await biz.waitForURL(/\/business\/messages\//);
  await expect(biz.locator("section").getByText(/^マッチが成立しました。/)).toBeVisible();

  // contact-info warning
  await biz.getByLabel("メッセージ").fill("詳しくは 090-1234-5678 までお電話ください");
  await biz.getByRole("button", { name: "送信", exact: true }).click();
  await expect(biz.getByText(/電話番号が含まれているようです/)).toBeVisible();
  await biz.getByRole("button", { name: "修正する" }).click();
  await biz.getByLabel("メッセージ").fill("ご相談ありがとうございます。現地調査の候補日を教えてください。");
  await biz.getByRole("button", { name: "送信", exact: true }).click();
  await expect(biz.locator("section").getByText("現地調査の候補日を教えてください。", { exact: false }).last()).toBeVisible();

  // 4. Company submits a quote
  await biz.getByRole("link", { name: "見積もり作成" }).click();
  await biz.getByLabel("工事項目").first().fill("外壁塗装一式");
  await biz.getByLabel("単価").first().fill("1000000");
  await biz.locator('input[name="warranty_years"]').fill("10");
  await biz.locator('input[name="duration_days"]').fill("14");
  await biz.getByRole("button", { name: "見積もりを提出" }).click();
  await biz.waitForURL(/\/business\/messages\//);
  await expect(biz.locator("section").getByText("110万円").first()).toBeVisible();

  // 5. Customer sees the chat message + quote, compares and decides
  await page.goto("/messages");
  await page.getByRole("link", { name: /湘南ペイント/ }).first().click();
  await expect(page.locator("section").getByText("現地調査の候補日を教えてください。", { exact: false }).last()).toBeVisible();
  await page.goto(projectUrl.replace("/matches?project=", "/quotes?project="));
  await expect(page.getByRole("heading", { name: "見積もり比較" })).toBeVisible();
  await page.getByRole("button", { name: "この会社に決める" }).first().click();
  await page.getByRole("button", { name: "決定する" }).click();
  await page.waitForURL(/\/projects\/.+decided=1/);
  await expect(page.getByText("契約記録")).toBeVisible();
  await expect(page.getByText("1,100,000円")).toBeVisible();

  // 6. Admin dashboard reflects the activity
  const admin = await demoLogin(browser, "SUMATCH運営");
  await admin.goto("/admin");
  await expect(admin.getByText("過去30日のファネル")).toBeVisible();
  await admin.goto("/admin?tab=contracts");
  await expect(admin.getByText("テスト 花子")).toBeVisible();
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
