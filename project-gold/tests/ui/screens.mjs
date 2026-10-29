// 主要画面のスクリーンショットを撮る（改修前後の比較用）。
// 使い方: node tests/ui/screens.mjs <label>   出力: docs/screenshots/<label>/*.png
// 前提: npm run dev:api（--reset 直後のデモデータ）と npm run web が起動していること
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8081';
const label = process.argv[2] || 'current';
const out = join(process.cwd(), 'docs', 'screenshots', label);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
async function session(email, width = 390, height = 844) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'ja-JP' });
  const p = await ctx.newPage();
  if (email) {
    await p.goto(`${BASE}/auth/sign-in`, { waitUntil: 'networkidle' });
    await p.getByTestId('login-email').fill(email);
    await p.getByTestId('login-password').fill('DemoPass123!');
    await p.getByTestId('login-submit').click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20000 });
  }
  return p;
}
async function shot(p, path, name, scroll = 0) {
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  if (scroll) {
    await p.mouse.move(200, 400);
    await p.mouse.wheel(0, scroll);
    await p.waitForTimeout(800);
  }
  await p.screenshot({ path: join(out, `${name}.png`) });
  console.log('✔', name);
}

const anon = await session(null);
await shot(anon, '/', '01-landing');
const man = await session('taro@demo.projectgold.local');
await shot(man, '/m', '02-man-home');
await shot(man, '/m', '03-man-home-scroll', 700);
await shot(man, '/woman/b0000000-0000-4000-8000-000000000001', '04-woman-detail-locked');
await shot(man, '/woman/b0000000-0000-4000-8000-000000000001', '05-woman-detail-locked-scroll', 900);
await shot(man, '/membership', '06-membership');
const regular = await session('regular@demo.projectgold.local');
await regular.goto(`${BASE}/m/messages`, { waitUntil: 'networkidle' });
await regular.waitForTimeout(1500);
await regular.locator('[data-testid^="conv-"]').first().click();
await regular.waitForTimeout(2000);
await regular.screenshot({ path: join(out, '07-chat.png') });
console.log('✔ 07-chat');
const woman = await session('misaki@demo.projectgold.local');
await shot(woman, '/w', '08-woman-home');
await shot(woman, '/w', '09-woman-home-scroll', 700);
const admin = await session('admin@demo.projectgold.local', 1280, 860);
await shot(admin, '/admin', '10-admin-dashboard');
await browser.close();
