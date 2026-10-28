// UI 通しテスト（Playwright / Chromium）。
//  前提: 開発サーバー(npm run dev:api) と Web(npm run web もしくは BASE_URL) が起動していること。
//  実行: npm run test:ui   結果: test-results/ui/*.png と report.json
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const OUT = join(process.cwd(), 'test-results', 'ui');
mkdirSync(OUT, { recursive: true });
const YUI = 'b0000000-0000-4000-8000-000000000005';
const report = { base: BASE, startedAt: new Date().toISOString(), steps: [], layout: [], consoleErrors: [] };

function step(name, ok, detail = '') {
  report.steps.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function newPage(browser, width = 390, height = 844) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'ja-JP' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`[${width}] ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => report.consoleErrors.push(`[${width}] PAGEERROR ${e.message.slice(0, 200)}`));
  return page;
}
const shot = async (page, name) => { await page.waitForTimeout(900); await page.screenshot({ path: join(OUT, `${name}.png`) }); };
const go = (page, path) => page.goto(BASE + path, { waitUntil: 'networkidle' });
async function demoLogin(page, who) {
  await go(page, '/auth/sign-in');
  await page.getByTestId(`demo-${who}`).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20000 });
  await page.waitForTimeout(800);
}
async function confirmOk(page) {
  await page.getByTestId('confirm-ok').click();
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
try {
  // ------------------------------------------------------------ 1. 男性の新規登録
  const man = await newPage(browser);
  const email = `ui-${Date.now()}@example.com`;
  await go(man, '/');
  await man.getByTestId('cta-start').click();
  await man.getByTestId('role-man').click();
  await man.getByTestId('signup-name').fill('UIテスト男性');
  await man.getByTestId('signup-email').fill(email);
  await man.getByTestId('signup-password').fill('UiTestPass123');
  await man.getByTestId('signup-adult').click();
  await man.getByTestId('signup-agree').click();
  await man.getByTestId('signup-submit').click();
  await man.waitForURL(/\/m/, { timeout: 20000 });
  await shot(man, '01-man-home-after-signup');
  step('男性が新規登録してホームに遷移', (await man.getByText('本人確認が必要です').count()) > 0, email);

  // ------------------------------------------------------------ 2. 本人確認（テスト提出）→ 運営が承認
  await go(man, '/verification');
  await man.getByTestId('verify-year').fill('1990');
  await man.getByTestId('verify-consent').click();
  await man.getByTestId('verify-submit').click();
  await man.waitForTimeout(1200);
  step('本人確認をテスト提出（審査中）', (await man.getByText('審査中').count()) > 0);

  const admin = await newPage(browser, 1280, 860);
  await demoLogin(admin, 'admin');
  await shot(admin, '02-admin-dashboard');
  await go(admin, '/admin/review');
  await admin.waitForTimeout(1200);
  const approve = admin.locator('[data-testid^="verify-approve-"]').first();
  await approve.click();
  await admin.waitForTimeout(1500);
  await shot(admin, '03-admin-review-approved');
  await go(man, '/verification');
  await man.waitForTimeout(1200);
  step('運営が本人確認を承認し、男性側に反映', (await man.getByText('確認済み').count()) > 0);

  // ------------------------------------------------------------ 3. 検索 → 詳細 → ロック表示の確認
  await go(man, '/m/search');
  await man.waitForTimeout(1500);
  await shot(man, '04-man-search');
  await go(man, '/woman/b0000000-0000-4000-8000-000000000001');
  await man.waitForTimeout(1500);
  await shot(man, '05-locked-S-rank');
  step('S ランクの女性はロックと解放方法を表示', (await man.getByTestId('unlock-cta').count()) > 0);

  // ------------------------------------------------------------ 4. C ランク・幅広く受付の女性へ予約申請
  await go(man, `/woman/${YUI}`);
  await man.waitForTimeout(1500);
  await man.getByTestId('slot-0').click();
  await man.getByTestId('request-message').fill('はじめまして。UIテストからの申請です。');
  await shot(man, '06-request-sheet');
  await man.getByTestId('request-submit').click();
  await man.waitForURL(/\/booking\//, { timeout: 15000 });
  const bookingUrl = new URL(man.url()).pathname;
  await shot(man, '07-booking-requested');
  step('予約申請が作成され「承認待ち」', (await man.getByText('承認待ち').count()) > 0, bookingUrl);

  // ------------------------------------------------------------ 5. 女性が承認
  const woman = await newPage(browser);
  await demoLogin(woman, 'yui');
  await go(woman, '/w/requests');
  await woman.waitForTimeout(1500);
  await shot(woman, '08-woman-requests');
  const bookingId = bookingUrl.split('/').pop();
  await woman.getByTestId(`accept-${bookingId}`).click();
  await confirmOk(woman);
  await go(woman, bookingUrl);
  await woman.waitForTimeout(1200);
  await shot(woman, '09-woman-booking-accepted');
  step('女性が承認し「予約確定」', (await woman.getByText('予約確定').count()) > 0);

  // ------------------------------------------------------------ 6. チャット
  await go(man, bookingUrl);
  await man.waitForTimeout(1200);
  await man.getByTestId('booking-chat').click();
  await man.waitForURL(/\/chat\//);
  const chatUrl = new URL(man.url()).pathname;
  await man.getByTestId('chat-input').fill('承認ありがとうございます。当日よろしくお願いします。');
  await man.getByTestId('chat-send').click();
  await man.waitForTimeout(1500);
  await go(woman, chatUrl);
  await woman.waitForTimeout(1500);
  const seen = (await woman.getByText('承認ありがとうございます。当日よろしくお願いします。').count()) > 0;
  await woman.getByTestId('chat-input').fill('こちらこそ、お待ちしています。');
  await woman.getByTestId('chat-send').click();
  await man.waitForTimeout(4500); // ポーリング（Realtime 無効時）で反映
  await shot(man, '10-chat');
  step('マッチ済みの男女でチャットが双方向に届く', seen && (await man.getByText('こちらこそ、お待ちしています。').count()) > 0);
  // 禁止語はサーバーで拒否される
  await man.getByTestId('chat-input').fill('ホ別でどうですか');
  await man.getByTestId('chat-send').click();
  await man.waitForTimeout(1200);
  step('禁止語を含むメッセージは送信拒否', (await man.getByText(/禁止されている内容/).count()) > 0);

  // 第三者（健一）は同じチャットを開けない
  const third = await newPage(browser);
  await demoLogin(third, 'kenichi');
  await go(third, chatUrl);
  await third.waitForTimeout(1500);
  await shot(third, '11-third-party-chat-denied');
  step('第三者はチャットを閲覧できない', (await third.getByText('読み込めませんでした').count()) > 0);

  // ------------------------------------------------------------ 7. 完了 → 実績反映
  const before = await (async () => { await go(man, '/membership'); await man.waitForTimeout(1200); return man.getByText(/確定利用額 ¥/).first().textContent(); })();
  await go(woman, bookingUrl);
  await woman.waitForTimeout(1200);
  await woman.getByTestId('booking-complete').click();
  await confirmOk(woman);
  await shot(woman, '12-woman-completed');
  await go(woman, '/earnings');
  await woman.waitForTimeout(1200);
  await shot(woman, '13-woman-earnings');
  await go(man, '/membership');
  await man.waitForTimeout(1500);
  const after = await man.getByText(/確定利用額 ¥/).first().textContent();
  await shot(man, '14-man-membership-after');
  step('完了後に男性の確定利用額が増え、女性の報酬台帳に記録', before !== after && (await woman.getByText('予約完了').count()) > 0, `${before} → ${after}`);

  // ------------------------------------------------------------ 8. サブスク（サンドボックス）で解放ランクが変化
  await man.getByTestId('plan-BLACK').click();
  await confirmOk(man);
  await man.waitForTimeout(1200);
  await go(man, '/woman/b0000000-0000-4000-8000-000000000001');
  await man.waitForTimeout(1500);
  await shot(man, '15-unlocked-after-BLACK');
  step('BLACK（デモ）で S ランクの申し込み条件が解除', (await man.getByTestId('unlock-cta').count()) === 0);

  // ------------------------------------------------------------ 9. 通報フォーム
  await go(man, bookingUrl);
  await man.waitForTimeout(1000);
  await man.getByText('このお相手を通報する').click();
  await man.waitForURL(/\/report/);
  await man.getByText('迷惑行為・脅迫・つきまとい').click();
  await man.getByTestId('report-detail').fill('UIテストの通報です');
  await man.getByTestId('report-submit').click();
  await man.waitForTimeout(1200);
  await go(admin, '/admin/reports');
  await admin.waitForTimeout(1500);
  await shot(admin, '16-admin-reports');
  step('通報が運営の通報一覧に届く', (await admin.getByText('UIテストの通報です').count()) > 0);

  // ------------------------------------------------------------ 10. 権限分離（UI）: 男性は管理画面に入れない
  await go(man, '/admin');
  await man.waitForTimeout(1500);
  step('一般ユーザーは /admin に入れない', !new URL(man.url()).pathname.startsWith('/admin') || (await man.getByText('ADMIN CONSOLE').count()) === 0, man.url());

  // ------------------------------------------------------------ 11. 画面幅ごとの表示崩れチェック
  const widths = [320, 375, 390, 430, 768, 1280];
  const pagesToCheck = [
    { who: null, path: '/' }, { who: null, path: '/auth/sign-in' },
    { who: 'taro', path: '/m' }, { who: 'taro', path: '/m/search' }, { who: 'taro', path: `/woman/${YUI}` }, { who: 'taro', path: '/membership' },
    { who: 'misaki', path: '/w' }, { who: 'misaki', path: '/w/requests' }, { who: 'misaki', path: '/schedule-new' },
    { who: 'admin', path: '/admin' }, { who: 'admin', path: '/admin/config' },
  ];
  for (const w of widths) {
    const sessions = {};
    for (const pg of pagesToCheck) {
      let page = sessions[pg.who ?? 'anon'];
      if (!page) {
        page = await newPage(browser, w, w >= 768 ? 1000 : 844);
        if (pg.who) await demoLogin(page, pg.who);
        sessions[pg.who ?? 'anon'] = page;
      }
      await go(page, pg.path);
      await page.waitForTimeout(1300);
      const m = await page.evaluate(() => {
        const vw = window.innerWidth;
        let offenders = 0;
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
            let p = el.parentElement; let clipped = false;
            while (p) { const s = getComputedStyle(p); if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') { clipped = true; break; } p = p.parentElement; }
            if (!clipped) offenders++;
          }
        }
        const buttons = Array.from(document.querySelectorAll('[role="button"]')).filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        const tiny = buttons.filter((b) => { const r = b.getBoundingClientRect(); return r.height < 28; }).length;
        return { scrollW: document.documentElement.scrollWidth, vw, offenders, buttons: buttons.length, tiny };
      });
      const ok = m.scrollW <= m.vw + 1 && m.offenders === 0;
      report.layout.push({ width: w, path: pg.path, ...m, ok });
      if (pg.path === '/' || pg.path === '/m' || pg.path === `/woman/${YUI}` || pg.path === '/admin' || pg.path === '/w') {
        await page.screenshot({ path: join(OUT, `layout-${w}-${pg.path.replace(/\W+/g, '_') || 'root'}.png`) });
      }
    }
    for (const p of Object.values(sessions)) await p.context().close();
  }
  const bad = report.layout.filter((l) => !l.ok);
  step('320/375/390/430/768/1280px で横スクロール・はみ出しなし', bad.length === 0, bad.map((b) => `${b.width}${b.path}`).join(', '));
} catch (e) {
  report.error = String(e?.stack || e);
  console.error(e);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(`\nsteps: ${report.steps.filter((s) => s.ok).length}/${report.steps.length} passed, console errors: ${report.consoleErrors.length}`);
}
