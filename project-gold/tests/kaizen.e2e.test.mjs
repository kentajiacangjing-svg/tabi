// UI/UX 改善で追加・変更した表示用データと、改善指示書の必須ルールを確認する統合テスト。
// 実行: node --test tests/kaizen.e2e.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createDevServer } from '../dev-server/server.mjs';

let server;
const PW = 'DemoPass123!';
const W = { misaki: 'b0000000-0000-4000-8000-000000000001', yui: 'b0000000-0000-4000-8000-000000000005', hinano: 'b0000000-0000-4000-8000-000000000004' };

const client = () => createClient(server.url, server.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  assert.equal(error, null);
  return c;
}
async function rpc(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { hint: error.hint });
  return data;
}
async function rpcErr(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  assert.ok(error, `${fn} should fail but returned ${JSON.stringify(data)?.slice(0, 160)}`);
  return error;
}
/** シードと重ならない日時に枠を作る */
async function slot(woman, daysAhead, hourJst, price = 10000) {
  const t = new Date(); t.setUTCDate(t.getUTCDate() + daysAhead); t.setUTCHours(hourJst - 9, 0, 0, 0);
  return rpc(woman, 'create_slot', { p_start: t.toISOString(), p_end: new Date(t.getTime() + 2 * 3600000).toISOString(), p_area: '恵比寿', p_plan_type: 'カフェ', p_price: price, p_note: '' });
}

before(async () => { server = await createDevServer({ port: 0, memory: true, log: () => {} }); });
after(async () => { await server?.close(); });

test('K1. FREE 会員は S ランクへ申し込めず、プラン解放後は申し込める（成立には承認が必要）', async () => {
  const taro = await login('taro@demo.projectgold.local');
  const misaki = await login('misaki@demo.projectgold.local');
  let d = await rpc(taro, 'get_woman_detail', { p_woman: W.misaki });
  assert.equal(d.eligibility.rank_locked, true);
  assert.equal(d.eligibility.can_apply, false);
  const e = await rpcErr(taro, 'submit_application', { p_woman: W.misaki, p_message: 'はじめまして' });
  assert.equal(e.hint, 'NOT_ELIGIBLE');
  assert.match(e.message, /ランク/);

  const ov = await rpc(taro, 'sandbox_subscribe', { p_plan: 'BLACK' });
  assert.equal(ov.access.unlocked_rank, 'S');
  d = await rpc(taro, 'get_woman_detail', { p_woman: W.misaki });
  assert.equal(d.eligibility.rank_locked, false);
  // 解放は申し込み資格。美咲さんは「自分で選ぶ」モードなので、まず申請→承認が必要
  assert.ok(d.eligibility.reasons.some((r) => r.code === 'APPROVAL_REQUIRED'));
  await rpc(taro, 'submit_application', { p_woman: W.misaki, p_message: 'はじめまして。よろしくお願いします。' });
  const inc = await rpc(misaki, 'list_incoming');
  const app = inc.applications.find((a) => a.man.display_name === '太郎');
  assert.ok(app, '女性に申請が届く');
  // 女性は断れる
  await rpc(misaki, 'decide_application', { p_id: app.id, p_approve: false });
  d = await rpc(taro, 'get_woman_detail', { p_woman: W.misaki });
  assert.equal(d.eligibility.can_request, false, '辞退されたら予約申請できない');
});

test('K2. 予約は女性の承認で成立し、未完了（与信のみ）の決済は利用額に計上されない', async () => {
  const ken = await login('kenichi@demo.projectgold.local');
  const yui = await login('yui@demo.projectgold.local');
  const s = await slot(yui, 15, 13, 12000);
  const spend0 = (await rpc(ken, 'membership_overview')).spend_total;
  const b = await rpc(ken, 'request_booking', { p_slot: s.id, p_message: 'よろしくお願いします' });
  assert.equal((await rpc(ken, 'get_booking', { p_id: b.id })).status, 'requested', '申し込みだけでは確定しない');

  const dash0 = await rpc(yui, 'woman_dashboard');
  const acc = await rpc(yui, 'accept_booking', { p_id: b.id });
  assert.equal(acc.status, 'accepted');
  assert.equal(acc.payment.status, 'authorized');
  assert.equal((await rpc(ken, 'membership_overview')).spend_total, spend0, '承認済み・未完了（与信のみ）は利用額に含めない');

  // 女性ホーム: 予定（見込み）に入り、確定には入らない
  const dash1 = await rpc(yui, 'woman_dashboard');
  assert.equal(dash1.expected_count, dash0.expected_count + 1);
  assert.ok(dash1.expected_net > dash0.expected_net && dash1.expected_net - dash0.expected_net < 12000, '手数料控除後の見込み額');
  assert.equal(dash1.month_net, dash0.month_net);

  // チャット: 相手との予約状況と既読位置が返る
  const conv = (await rpc(ken, 'get_booking', { p_id: b.id })).conversation_id;
  await rpc(ken, 'send_message', { p_conversation: conv, p_body: '承認ありがとうございます。' });
  let t = await rpc(ken, 'get_messages', { p_conversation: conv, p_after: 0 });
  assert.equal(t.booking.id, b.id);
  assert.equal(t.booking.status, 'accepted');
  const myLast = t.messages.at(-1).id;
  assert.ok(t.counterpart_read_id < myLast, '相手はまだ読んでいない');
  await rpc(yui, 'get_messages', { p_conversation: conv, p_after: 0 });
  t = await rpc(ken, 'get_messages', { p_conversation: conv, p_after: myLast });
  assert.ok(t.counterpart_read_id >= myLast, '相手が開くと既読になる');

  // 完了で初めて利用額・確定報酬に計上
  await rpc(yui, 'complete_booking', { p_id: b.id });
  assert.ok((await rpc(ken, 'membership_overview')).spend_total > spend0);
  const dash2 = await rpc(yui, 'woman_dashboard');
  assert.equal(dash2.expected_count, dash0.expected_count);
  assert.ok(dash2.month_net > dash0.month_net);
  assert.equal(dash2.month_completed, dash0.month_completed + 1);
});

test('K3. ブロックすると申し込み・申請ができず、検索にも出ない', async () => {
  const taro = await login('taro@demo.projectgold.local');
  const hinano = await login('hinano@demo.projectgold.local');
  const s = await slot(hinano, 16, 15);
  await rpc(taro, 'block_user', { p_target: W.hinano });
  const e1 = await rpcErr(taro, 'request_booking', { p_slot: s.id, p_message: '' });
  assert.ok(e1.hint, `request_booking blocked: ${e1.message}`);
  const e2 = await rpcErr(taro, 'submit_application', { p_woman: W.hinano, p_message: 'x' });
  assert.ok(e2.hint, `submit_application blocked: ${e2.message}`);
  const list = await rpc(taro, 'search_women', {});
  assert.ok(!list.some((w) => w.id === W.hinano));
});

test('K4. 女性ホームの最上位ランク判定と、管理ダッシュボードの状態別件数', async () => {
  const misaki = await login('misaki@demo.projectgold.local');
  const yui = await login('yui@demo.projectgold.local');
  const m = await rpc(misaki, 'woman_dashboard');
  assert.equal(m.rank_code, 'S');
  assert.equal(m.is_top_rank, true);
  const y = await rpc(yui, 'woman_dashboard');
  assert.equal(y.is_top_rank, false);
  assert.ok(y.next_rank);
  assert.equal(typeof y.held_net, 'number');

  const admin = await login('admin@demo.projectgold.local');
  const d = await rpc(admin, 'admin_dashboard');
  assert.equal(d.is_sandbox, true);
  for (const k of ['requested', 'accepted', 'completed', 'declined', 'canceled', 'disputed']) assert.equal(typeof d.bookings[k], 'number', k);
  const sum = Object.values(d.bookings).reduce((a, b) => a + b, 0);
  assert.equal(sum, d.booking_total, '状態別件数の合計は申込総数と一致');
  assert.equal(typeof d.applications.pending, 'number');
  for (const k of ['authorized', 'captured', 'voided', 'refunded']) assert.equal(typeof d.payments[k], 'number', k);
  // 一般ユーザーは呼べない
  await rpcErr(yui, 'admin_dashboard', {});
});
