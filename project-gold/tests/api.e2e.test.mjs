// 実際の supabase-js クライアントで開発サーバー（本番と同じ SQL / RLS）を操作する統合テスト。
// 実行: npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createDevServer } from '../dev-server/server.mjs';

let server;
const DEMO_PW = 'DemoPass123!';
const W = {
  misaki: 'b0000000-0000-4000-8000-000000000001', // S, select mode
  rena: 'b0000000-0000-4000-8000-000000000002', // A, select mode
  sakura: 'b0000000-0000-4000-8000-000000000003', // B, open
  hinano: 'b0000000-0000-4000-8000-000000000004', // B, open
  yui: 'b0000000-0000-4000-8000-000000000005', // C, open
};

function client() {
  return createClient(server.url, server.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function login(email, password = DEMO_PW) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `login ${email}: ${error?.message}`);
  return c;
}
async function rpc(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw Object.assign(new Error(error.message), { code: error.code, hint: error.hint });
  return data;
}
async function rpcErr(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  assert.ok(error, `${fn} should fail but returned ${JSON.stringify(data)?.slice(0, 200)}`);
  return error;
}

const ctx = {};

before(async () => {
  server = await createDevServer({ port: 0, memory: true, log: () => {} });
});
after(async () => {
  await server?.close();
});

test('1-2. 男女で別々に登録・ログインし、プロフィールが再ログイン後も保持される', async () => {
  const man = client();
  const { data: s1, error: e1 } = await man.auth.signUp({ email: 'newman@example.com', password: 'Passw0rd!x', options: { data: { role: 'man', display_name: '新規男性' } } });
  assert.equal(e1, null);
  assert.ok(s1.session);
  let me = await rpc(man, 'get_me');
  assert.equal(me.role, 'man');
  assert.equal(me.verification.status, 'unsubmitted');
  await rpc(man, 'update_my_profile', { p_display_name: '新規男性', p_area: '港区', p_bio: '食事とワインが好きです。よろしくお願いします。' });

  const woman = client();
  const { error: e2 } = await woman.auth.signUp({ email: 'newwoman@example.com', password: 'Passw0rd!y', options: { data: { role: 'woman', display_name: '新規女性' } } });
  assert.equal(e2, null);
  me = await rpc(woman, 'get_me');
  assert.equal(me.role, 'woman');
  await rpc(woman, 'update_woman_profile', {
    p_display_name: 'みお', p_area: '銀座', p_headline: 'よろしくお願いします', p_bio: '銀座のお店で働いています。美術館とカフェが好きで、落ち着いたお話が好きです。',
    p_areas: ['銀座', '有楽町'], p_plan_types: ['食事', 'カフェ'], p_is_published: false,
  });

  // admin ロールの自己申告は拒否される
  const bad = client();
  const { error: e3 } = await bad.auth.signUp({ email: 'evil@example.com', password: 'Passw0rd!z', options: { data: { role: 'admin' } } });
  assert.ok(e3, 'admin signup must fail');

  // 再ログインで保持
  const man2 = await login('newman@example.com', 'Passw0rd!x');
  me = await rpc(man2, 'get_me');
  assert.equal(me.area, '港区');
  assert.match(me.man.bio, /ワイン/);
  const woman2 = await login('newwoman@example.com', 'Passw0rd!y');
  me = await rpc(woman2, 'get_me');
  assert.equal(me.display_name, 'みお');
  assert.deepEqual(me.woman.areas, ['銀座', '有楽町']);
  ctx.newMan = man2;
  ctx.newWoman = woman2;
  ctx.newWomanId = me.id;

  // 誤ったパスワード
  const { error: e4 } = await client().auth.signInWithPassword({ email: 'newman@example.com', password: 'wrong-password' });
  assert.ok(e4);
});

test('3. 画像アップロード・表示（自分のフォルダのみ、署名URLで配信）', async () => {
  const c = ctx.newWoman;
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  const path = `${ctx.newWomanId}/test-1.png`;
  const { error } = await c.storage.from('profile-photos').upload(path, png, { contentType: 'image/png' });
  assert.equal(error, null, error?.message);
  const me = await rpc(c, 'add_photo', { p_path: path });
  assert.equal(me.photos.length, 1);
  // 他人のフォルダには保存できない
  const { error: e2 } = await c.storage.from('profile-photos').upload(`${W.misaki}/evil.png`, png, { contentType: 'image/png' });
  assert.ok(e2, 'upload to other folder must fail');
  const e3 = await rpcErr(c, 'add_photo', { p_path: `${W.misaki}/evil.png` });
  assert.match(e3.message, /パスが不正/);
  // 署名URLで取得できる
  const { data: signed } = await c.storage.from('profile-photos').createSignedUrls([path], 60);
  const res = await fetch(signed[0].signedUrl);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  // 未ログインは署名できない
  const { data: anonSigned } = await client().storage.from('profile-photos').createSignedUrls(['demo/w1-1.svg'], 60);
  assert.equal(anonSigned?.[0]?.signedURL ?? null, null);
});

test('4-5. 女性検索・詳細、申込資格のロックがサブスク／利用額でサーバー判定により変化する', async () => {
  const taro = await login('taro@demo.projectgold.local');
  ctx.taro = taro;
  const list = await rpc(taro, 'search_women', {});
  assert.ok(list.length >= 6);
  const misaki = list.find((w) => w.id === W.misaki);
  assert.equal(misaki.rank_code, 'S');
  assert.equal(misaki.locked, true, 'FREE 会員は S ランクがロック');
  assert.equal(list.find((w) => w.id === W.yui).locked, false);
  assert.equal(misaki.venue.name, 'Lounge Aurum（デモ店舗）');
  assert.equal(list.find((w) => w.id === W.sakura).venue, null, '未確認・非公開の店舗は表示しない');
  // 絞り込み
  const ginza = await rpc(taro, 'search_women', { p_area: '銀座' });
  assert.ok(ginza.every((w) => w.area === '銀座' || w.areas.includes('銀座')));
  const bOnly = await rpc(taro, 'search_women', { p_rank: 'B' });
  assert.ok(bOnly.length >= 1 && bOnly.every((w) => w.rank_code === 'B'));

  let detail = await rpc(taro, 'get_woman_detail', { p_woman: W.sakura });
  assert.equal(detail.eligibility.rank_locked, true);
  assert.ok(detail.eligibility.reasons.some((r) => r.code === 'RANK_LOCKED'));
  const slot = detail.slots[0];
  const err = await rpcErr(taro, 'request_booking', { p_slot: slot.id, p_message: 'よろしくお願いします' });
  assert.equal(err.hint, 'RANK_LOCKED');

  // サブスク（サンドボックス）で B 解放 → 申込可能に
  const ov = await rpc(taro, 'sandbox_subscribe', { p_plan: 'SILVER' });
  assert.equal(ov.access.unlocked_rank, 'B');
  assert.equal(ov.access.source, 'plan');
  detail = await rpc(taro, 'get_woman_detail', { p_woman: W.sakura });
  assert.equal(detail.eligibility.can_request, true);
  // S はまだロック
  detail = await rpc(taro, 'get_woman_detail', { p_woman: W.misaki });
  assert.equal(detail.eligibility.rank_locked, true);

  // 利用額デモ（運営によるサンドボックス付与）で累計額ランクが上がる
  const admin = await login('admin@demo.projectgold.local');
  ctx.admin = admin;
  const taroId = (await rpc(taro, 'get_me')).id;
  ctx.taroId = taroId;
  await rpc(admin, 'admin_sandbox_credit_spend', { p_user: taroId, p_amount: 200000, p_note: 'テスト' });
  const me = await rpc(taro, 'get_me');
  assert.equal(me.man.spend_total, 200000);
  assert.equal(me.access.spend_rank, 'A');
  assert.equal(me.access.unlocked_rank, 'A', '利用額(A)とプラン(B)の広い方');
  assert.equal(me.access.source, 'spend');

  // 一般ユーザーは利用額付与 RPC を使えない
  const e2 = await rpcErr(taro, 'admin_sandbox_credit_spend', { p_user: taroId, p_amount: 9999999, p_note: 'x' });
  assert.match(e2.message, /管理者権限/);
});

test('6. 女性のモード切替・申請承認/辞退・予約状態遷移・ダブルブッキング防止', async () => {
  const taro = ctx.taro;
  const ken = await login('kenichi@demo.projectgold.local');
  ctx.ken = ken;
  const yui = await login('yui@demo.projectgold.local');
  ctx.yui = yui;

  // 「自分で選ぶ」モードに切替 → 予約申請不可、プロフィール申請のみ
  await rpc(yui, 'set_accept_settings', { p_accept_mode: 'select', p_accept_requests: true, p_min_man_level: 1, p_ng_note: '' });
  let d = await rpc(taro, 'get_woman_detail', { p_woman: W.yui });
  assert.equal(d.eligibility.can_request, false);
  assert.equal(d.eligibility.can_apply, true);
  const e = await rpcErr(taro, 'request_booking', { p_slot: d.slots[0].id, p_message: '' });
  assert.equal(e.hint, 'APPROVAL_REQUIRED');
  await rpc(taro, 'submit_application', { p_woman: W.yui, p_message: 'はじめまして。カフェでお話しできたら嬉しいです。' });
  let inc = await rpc(yui, 'list_incoming');
  assert.equal(inc.applications.length, 1);
  assert.equal(inc.applications[0].man.display_name, '太郎');
  assert.equal(inc.applications[0].man.spend_total, undefined, '女性に男性の利用額は見せない');
  await rpc(yui, 'decide_application', { p_id: inc.applications[0].id, p_approve: true });
  d = await rpc(taro, 'get_woman_detail', { p_woman: W.yui });
  assert.equal(d.eligibility.can_request, true);
  assert.ok(d.conversation_id);

  // 「幅広く受け付ける」に戻す。健一も申込可能に
  await rpc(yui, 'set_accept_settings', { p_accept_mode: 'open', p_accept_requests: true, p_min_man_level: 1, p_ng_note: '' });
  // シードの枠と重ならない時間帯（12日後の JST 12:00）にテスト用の枠を作る
  const T = new Date(); T.setUTCDate(T.getUTCDate() + 12); T.setUTCHours(3, 0, 0, 0);
  const iso = (ms) => new Date(ms).toISOString();
  const slotA = await rpc(yui, 'create_slot', { p_start: iso(T.getTime()), p_end: iso(T.getTime() + 2 * 3600000), p_area: '恵比寿', p_plan_type: 'カフェ', p_price: 12000, p_note: 'テスト枠' });
  const slotB = await rpc(yui, 'create_slot', { p_start: iso(T.getTime() + 3 * 3600000), p_end: iso(T.getTime() + 4 * 3600000), p_area: '恵比寿', p_plan_type: 'カフェ', p_price: 9000, p_note: '' });
  slotA.start_at = iso(T.getTime());
  const b1 = await rpc(taro, 'request_booking', { p_slot: slotA.id, p_message: 'よろしくお願いします' });
  const b2 = await rpc(ken, 'request_booking', { p_slot: slotA.id, p_message: '楽しみにしています' });
  const dup = await rpcErr(taro, 'request_booking', { p_slot: slotA.id, p_message: '' });
  assert.equal(dup.hint, 'DUPLICATE');
  // 幅広く受け付けるモードでも自動確定しない
  let bk = await rpc(taro, 'get_booking', { p_id: b1.id });
  assert.equal(bk.status, 'requested');
  // 男性は承認できない
  const e3 = await rpcErr(taro, 'accept_booking', { p_id: b1.id });
  assert.match(e3.message, /許可されていません/);
  // 女性が承認 → accepted、同じ枠の他申請は自動で不成立
  bk = await rpc(yui, 'accept_booking', { p_id: b1.id });
  assert.equal(bk.status, 'accepted');
  assert.equal(bk.payment.status, 'authorized');
  assert.equal(bk.payment.is_sandbox, true);
  assert.equal((await rpc(ken, 'get_booking', { p_id: b2.id })).status, 'declined');

  // 重なる時間帯の別枠を作り、同じ男性の予約が確定済みと重複 → サーバーで拒否
  const start = new Date(slotA.start_at);
  const overlap = await rpc(yui, 'create_slot', { p_start: new Date(start.getTime() + 30 * 60000).toISOString(), p_end: new Date(start.getTime() + 150 * 60000).toISOString(), p_area: '恵比寿', p_plan_type: 'カフェ', p_price: 9000, p_note: '' }).catch((x) => x);
  assert.equal(overlap.hint, 'SLOT_OVERLAP', '自分の枠同士の重複も拒否');
  const sakura = await login('sakura@demo.projectgold.local');
  const sk = await rpc(sakura, 'create_slot', { p_start: new Date(start.getTime() + 30 * 60000).toISOString(), p_end: new Date(start.getTime() + 90 * 60000).toISOString(), p_area: '新宿', p_plan_type: 'カフェ', p_price: 9000, p_note: '' });
  const conflict = await rpcErr(taro, 'request_booking', { p_slot: sk.id, p_message: '' });
  assert.equal(conflict.hint, 'BOOKING_CONFLICT');
  // 承認時の競合: 健一が別々の女性へ重なる時間帯の申請を出し、片方が確定した後にもう片方を承認しようとすると失敗
  const t0 = start.getTime() + 48 * 3600000;
  const yuiSlot = await rpc(yui, 'create_slot', { p_start: new Date(t0).toISOString(), p_end: new Date(t0 + 2 * 3600000).toISOString(), p_area: '恵比寿', p_plan_type: '食事', p_price: 15000, p_note: '' });
  const skSlot = await rpc(sakura, 'create_slot', { p_start: new Date(t0 + 30 * 60000).toISOString(), p_end: new Date(t0 + 90 * 60000).toISOString(), p_area: '新宿', p_plan_type: 'カフェ', p_price: 9000, p_note: '' });
  const kReqY = await rpc(ken, 'request_booking', { p_slot: yuiSlot.id, p_message: '' });
  const kReqS = await rpc(ken, 'request_booking', { p_slot: skSlot.id, p_message: '' });
  assert.equal((await rpc(yui, 'accept_booking', { p_id: kReqY.id })).status, 'accepted');
  const race = await rpcErr(sakura, 'accept_booking', { p_id: kReqS.id });
  assert.equal(race.hint, 'BOOKING_CONFLICT');
  assert.equal((await rpc(ken, 'get_booking', { p_id: kReqS.id })).status, 'requested');

  // 辞退
  const b4 = await rpc(taro, 'request_booking', { p_slot: slotB.id, p_message: '' });
  const dec = await rpc(yui, 'decline_booking', { p_id: b4.id, p_reason: '' });
  assert.equal(dec.status, 'declined');
  // 不正な遷移
  const bad = await rpcErr(yui, 'complete_booking', { p_id: b4.id });
  assert.equal(bad.hint, 'INVALID_TRANSITION');
  ctx.bookingId = b1.id;
  ctx.convId = d.conversation_id;
});

test('7. マッチ済みの男女でチャットでき、第三者は閲覧・送信不可（RPC と直接アクセスの両方）', async () => {
  const { taro, yui, ken } = ctx;
  await rpc(taro, 'send_message', { p_conversation: ctx.convId, p_body: 'こんにちは、当日はよろしくお願いします。' });
  await rpc(yui, 'send_message', { p_conversation: ctx.convId, p_body: 'こちらこそ、楽しみにしています！' });
  const m = await rpc(taro, 'get_messages', { p_conversation: ctx.convId, p_after: 0 });
  assert.equal(m.messages.length, 2);
  assert.equal(m.messages[1].mine, false);
  // 禁止語はサーバーで拒否
  const mod = await rpcErr(taro, 'send_message', { p_conversation: ctx.convId, p_body: 'ホ別でどうですか' });
  assert.equal(mod.hint, 'MODERATION_BLOCKED');
  // 第三者
  const e1 = await rpcErr(ken, 'get_messages', { p_conversation: ctx.convId, p_after: 0 });
  assert.match(e1.message, /見つかりません/);
  const e2 = await rpcErr(ken, 'send_message', { p_conversation: ctx.convId, p_body: 'のぞき見' });
  assert.equal(e2.hint, 'CHAT_FORBIDDEN');
  const { data: direct } = await ken.from('messages').select('*').eq('conversation_id', ctx.convId);
  assert.deepEqual(direct, [], 'RLS: 第三者は messages を直接読めない');
  const { data: directOwn } = await taro.from('messages').select('*').eq('conversation_id', ctx.convId);
  assert.equal(directOwn.length, 2);
  const { error: insErr } = await ken.from('messages').insert({ conversation_id: ctx.convId, sender_id: (await rpc(ken, 'get_me')).id, body: '直接書き込み' });
  assert.ok(insErr, 'RLS/権限: messages へ直接 INSERT できない');
});

test('8. 予約完了で女性の確定報酬・男女のメーター・ランク計算が更新される', async () => {
  const { taro, yui } = ctx;
  const before = await rpc(yui, 'woman_dashboard');
  const meBefore = await rpc(taro, 'get_me');
  const done = await rpc(yui, 'complete_booking', { p_id: ctx.bookingId });
  assert.equal(done.status, 'completed');
  assert.equal(done.payment.amount, null, '女性側には男性の支払額を出さない');
  const after = await rpc(yui, 'woman_dashboard');
  assert.equal(after.completed, before.completed + 1);
  assert.ok(after.total_net > before.total_net);
  const earn = await rpc(yui, 'get_earnings');
  assert.equal(earn.entries[0].type, 'earning');
  assert.equal(earn.entries[0].gross, earn.entries[0].fee + earn.entries[0].net);
  assert.ok(after.xp > before.xp);
  const meAfter = await rpc(taro, 'get_me');
  assert.ok(meAfter.man.spend_total > meBefore.man.spend_total);
  assert.ok(meAfter.man.xp > meBefore.man.xp);
  const bk = await rpc(taro, 'get_booking', { p_id: ctx.bookingId });
  assert.equal(bk.payment.status, 'captured');
  assert.equal(bk.earning, null, '男性側には女性の報酬を出さない');

  // 返金申請 → 運営承認で台帳が取り消され、利用額も減る
  await rpc(taro, 'request_refund', { p_booking: ctx.bookingId, p_reason: 'テスト返金' });
  const refunds = await rpc(ctx.admin, 'admin_list_refunds', { p_status: 'requested' });
  await rpc(ctx.admin, 'admin_decide_refund', { p_id: refunds[0].id, p_approve: true });
  const afterRefund = await rpc(yui, 'get_earnings');
  assert.equal(afterRefund.entries[0].type, 'reversal');
  assert.equal(afterRefund.total_net, before.total_net);
  assert.equal((await rpc(taro, 'get_me')).man.spend_total, meBefore.man.spend_total);
});

test('9. ブロック・通報・退会が機能する', async () => {
  const { taro, yui, admin } = ctx;
  const taroId = ctx.taroId;
  await rpc(taro, 'report_user', { p_target: W.yui, p_category: 'other', p_detail: 'テスト通報', p_booking: null, p_message: null });
  const reports = await rpc(admin, 'admin_list_reports', { p_status: 'open' });
  assert.ok(reports.some((r) => r.detail === 'テスト通報'));
  // 女性がブロック → 検索から消え、チャット不可
  await rpc(yui, 'block_user', { p_target: taroId });
  const list = await rpc(taro, 'search_women', {});
  assert.ok(!list.some((w) => w.id === W.yui));
  const e = await rpcErr(taro, 'get_messages', { p_conversation: ctx.convId, p_after: 0 });
  assert.match(e.message, /見つかりません/);
  const { data: direct } = await taro.from('messages').select('*').eq('conversation_id', ctx.convId);
  assert.deepEqual(direct, [], 'ブロック後は RLS でも読めない');
  await rpc(yui, 'unblock_user', { p_target: taroId });

  // 退会申請 → 以降の操作不可、運営が匿名化
  const del = ctx.newMan;
  const delId = (await rpc(del, 'get_me')).id;
  await rpc(del, 'request_account_deletion', { p_reason: 'テスト退会' });
  const blocked = await rpcErr(del, 'search_women', {});
  assert.equal(blocked.hint, 'ACCOUNT_INACTIVE');
  await rpc(admin, 'admin_process_deletion', { p_user: delId });
  const { error } = await client().auth.signInWithPassword({ email: 'newman@example.com', password: 'Passw0rd!x' });
  assert.ok(error, '退会処理後はログイン不可');
});

test('10. 管理者と一般ユーザーの権限分離・RLS 不正アクセス試験', async () => {
  const { taro, yui, admin } = ctx;
  // 管理 RPC は一般ユーザー不可
  for (const fn of ['admin_dashboard', 'admin_list_users', 'admin_list_audit', 'admin_list_settings']) {
    const e = await rpcErr(yui, fn, {});
    assert.match(e.message, /管理者権限/, fn);
  }
  const e2 = await rpcErr(taro, 'admin_update_setting', { p_key: 'payment_mode', p_value: 'live' });
  assert.match(e2.message, /管理者権限/);
  // 内部関数は直接呼べない（execute 権限なし）
  for (const fn of ['recompute_man', 'settle_booking_payment', 'transition_booking', 'notify', 'process_refund']) {
    const { error } = await taro.rpc(fn, {});
    assert.ok(error, `${fn} must not be callable`);
  }
  const { error: e3 } = await taro.rpc('recompute_man', { p_man: ctx.taroId, p_reason: 'x' });
  assert.equal(e3.code, '42501');
  // 自分のランク・利用額・権限を直接書き換えられない
  const { error: u1 } = await taro.from('men_profiles').update({ spend_total: 9999999, spend_rank_code: 'S' }).eq('user_id', ctx.taroId);
  assert.ok(u1);
  const { error: u2 } = await taro.from('profiles').update({ role: 'admin' }).eq('id', ctx.taroId);
  assert.ok(u2);
  const { error: u3 } = await yui.from('women_profiles').update({ rank_code: 'S' }).eq('user_id', W.yui);
  assert.ok(u3);
  const { error: u4 } = await taro.from('payments').insert({ user_id: ctx.taroId, kind: 'booking', amount: 1, status: 'captured' });
  assert.ok(u4);
  const { error: u5 } = await taro.from('membership_entitlements').insert({ user_id: ctx.taroId, plan_code: 'BLACK', current_period_end: '2099-01-01' });
  assert.ok(u5);
  const { error: u6 } = await yui.from('earnings_ledger').insert({ woman_id: W.yui, entry_type: 'earning', gross: 1, fee: 0, net: 1 });
  assert.ok(u6);
  // 他人のデータは読めない
  const { data: p1 } = await taro.from('profiles').select('*');
  assert.equal(p1.length, 1);
  const { data: p2 } = await taro.from('payments').select('*');
  assert.ok(p2.every((x) => x.user_id === ctx.taroId));
  const { data: p3 } = await taro.from('earnings_ledger').select('*');
  assert.deepEqual(p3, []);
  const { data: p4 } = await taro.from('verification_states').select('*');
  assert.equal(p4.length, 1);
  const { data: p5 } = await yui.from('audit_events').select('*');
  assert.deepEqual(p5, []);
  const { data: p6 } = await client().from('app_settings').select('*');
  assert.ok(p6.every((s) => s.is_public), '未ログインは公開設定のみ');
  // 運営の非公開キュレーション値は本人にも見えない
  const { error: rv } = await yui.from('women_profiles').select('review_score').eq('user_id', W.yui);
  assert.ok(rv, 'review_score は列権限で非公開');
  // 管理者は参照可能
  const { data: a1 } = await admin.from('profiles').select('*');
  assert.ok(a1.length > 5);
  const dash = await rpc(admin, 'admin_dashboard');
  assert.ok(dash.users.total >= 9);
  // 設定変更と監査ログ
  await rpc(admin, 'admin_upsert_plan', { p_code: 'SILVER', p_name: 'SILVER', p_price: 5980, p_unlock_rank: 'B', p_perks: ['Bランクまで申し込み可能'], p_is_active: true, p_sort: 2 });
  const pub = await rpc(client(), 'get_public_settings');
  assert.equal(pub.plans.find((p) => p.code === 'SILVER').monthly_price, 5980);
  const audit = await rpc(admin, 'admin_list_audit', { p_limit: 20 });
  assert.ok(audit.some((a) => a.action === 'admin.plan'));
});

test('13. 通し操作: 男性登録→本人確認→女性検索→申込→女性承認→チャット→完了→実績反映', async () => {
  const man = client();
  await man.auth.signUp({ email: 'flow@example.com', password: 'FlowPass123', options: { data: { role: 'man', display_name: '通し男性' } } });
  // 本人確認前は申込不可
  const yuiDetail = await rpc(man, 'get_woman_detail', { p_woman: W.yui });
  assert.ok(yuiDetail.eligibility.reasons.some((r) => r.code === 'VERIFY_REQUIRED'));
  const young = await rpcErr(man, 'submit_verification', { p_birth_year: new Date().getFullYear() - 18, p_consent: true });
  assert.equal(young.hint, 'AGE_RESTRICTED');
  const me = await rpc(man, 'submit_verification', { p_birth_year: 1990, p_consent: true });
  assert.equal(me.verification.status, 'pending');
  const queue = await rpc(ctx.admin, 'admin_review_queue');
  assert.ok(queue.verifications.some((v) => v.user_id === me.id));
  await rpc(ctx.admin, 'admin_set_verification', { p_user: me.id, p_status: 'approved', p_reason: null });

  const list = await rpc(man, 'search_women', { p_rank: 'C' });
  const target = list.find((w) => !w.locked && w.next_slot && w.accept_mode === 'open');
  assert.ok(target, 'C ランクで申込可能な女性');
  const d = await rpc(man, 'get_woman_detail', { p_woman: target.id });
  assert.equal(d.eligibility.can_request, true);
  const req = await rpc(man, 'request_booking', { p_slot: d.slots[0].id, p_message: 'はじめまして。よろしくお願いします。' });
  const woman = await login(target.id === W.yui ? 'yui@demo.projectgold.local' : 'akari@demo.projectgold.local');
  const inc = await rpc(woman, 'list_incoming');
  assert.ok(inc.bookings.some((b) => b.id === req.id));
  const acc = await rpc(woman, 'accept_booking', { p_id: req.id });
  assert.equal(acc.status, 'accepted');
  await rpc(man, 'send_message', { p_conversation: acc.conversation_id, p_body: '承認ありがとうございます！' });
  await rpc(woman, 'send_message', { p_conversation: acc.conversation_id, p_body: '当日お待ちしています。' });
  const notes = await rpc(man, 'list_notifications', { p_limit: 20 });
  assert.ok(notes.some((n) => n.title === '予約が確定しました'));
  const before = await rpc(man, 'membership_overview');
  await rpc(woman, 'complete_booking', { p_id: req.id });
  const after = await rpc(man, 'membership_overview');
  assert.equal(after.spend_total, before.spend_total + d.slots[0].price);
  assert.ok(after.xp > before.xp);
  assert.ok(after.badges.find((b) => b.code === 'first').earned);
  const hist = await rpc(man, 'list_my_bookings', { p_scope: 'past' });
  assert.equal(hist[0].status, 'completed');
});
