-- デモ/開発環境専用シード。本番環境では実行しないこと。
-- パスワードはすべて DemoPass123! （デモ用）。写真は自作イラストと AI 生成のデモ写真（実在人物ではない・「DEMO・AI生成」表記入り）（seed-assets/demo/*.svg）。

update public.app_settings set value = 'true' where key = 'demo_mode';

create or replace function pg_temp.demo_user(p_id uuid, p_email text, p_role text, p_name text) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('role', p_role, 'display_name', p_name),
    now() - interval '60 days', now(), '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now(), now());
  update public.verification_states set status = 'approved', method = 'demo', birth_year = 1995, submitted_at = now(), reviewed_at = now()
    where user_id = p_id;
end $$;

-- ---------------------------------------------------------------- users
select pg_temp.demo_user('a0000000-0000-4000-8000-000000000001', 'admin@demo.projectgold.local', 'man', '運営デモ');
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
delete from public.men_profiles where user_id = 'a0000000-0000-4000-8000-000000000001';

select pg_temp.demo_user('b0000000-0000-4000-8000-000000000001', 'misaki@demo.projectgold.local', 'woman', '美咲');
select pg_temp.demo_user('b0000000-0000-4000-8000-000000000002', 'rena@demo.projectgold.local', 'woman', '玲奈');
select pg_temp.demo_user('b0000000-0000-4000-8000-000000000003', 'sakura@demo.projectgold.local', 'woman', 'さくら');
select pg_temp.demo_user('b0000000-0000-4000-8000-000000000004', 'hinano@demo.projectgold.local', 'woman', 'ひなの');
select pg_temp.demo_user('b0000000-0000-4000-8000-000000000005', 'yui@demo.projectgold.local', 'woman', 'ゆい');
select pg_temp.demo_user('b0000000-0000-4000-8000-000000000006', 'akari@demo.projectgold.local', 'woman', 'あかり');

select pg_temp.demo_user('c0000000-0000-4000-8000-000000000001', 'taro@demo.projectgold.local', 'man', '太郎');
select pg_temp.demo_user('c0000000-0000-4000-8000-000000000002', 'kenichi@demo.projectgold.local', 'man', '健一');
select pg_temp.demo_user('c0000000-0000-4000-8000-000000000003', 'regular@demo.projectgold.local', 'man', '常連デモ');

-- ---------------------------------------------------------------- women profiles
update public.profiles p set area = v.area from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, '銀座'), ('b0000000-0000-4000-8000-000000000002'::uuid, '六本木'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, '新宿'), ('b0000000-0000-4000-8000-000000000004'::uuid, '渋谷'),
  ('b0000000-0000-4000-8000-000000000005'::uuid, '恵比寿'), ('b0000000-0000-4000-8000-000000000006'::uuid, '銀座')) v(id, area)
where p.id = v.id;

update public.women_profiles w set headline = v.headline, bio = v.bio, areas = v.areas, plan_types = v.plans,
  accept_mode = v.mode::public.accept_mode, review_score = v.review, is_published = true
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, '静かなラウンジで、ゆっくりお話を', '銀座で働いて5年目です。ワインと美術館めぐりが好きで、落ち着いた会話を大切にしています。お食事でもカフェでも、心地よい時間をご一緒できたら嬉しいです。', '{銀座,日本橋}'::text[], '{食事,カフェ,バー同席}'::text[], 'select', 92),
  ('b0000000-0000-4000-8000-000000000002'::uuid, '笑顔とおいしいお店が好きです', '六本木在住。話題のレストランを開拓するのが趣味です。お仕事のお話や旅行の話を聞くのが大好きなので、気軽に声をかけてください。', '{六本木,麻布十番}', '{食事,バー同席}', 'select', 85),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'カフェ巡りとお散歩が好き', '新宿エリア中心です。カフェでのんびりお話しするのが好きです。映画や音楽の話ができたら嬉しいです。初めての方も歓迎です。', '{新宿,代々木}', '{カフェ,食事}', 'open', 75),
  ('b0000000-0000-4000-8000-000000000004'::uuid, '和食とお酒の話ならおまかせ', '渋谷・表参道あたりでお会いできます。日本酒と和食が好きで、おすすめのお店をご紹介できます。気軽にお申し込みください。', '{渋谷,表参道}', '{食事,バー同席}', 'open', 60),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'はじめまして、ゆいです', '恵比寿で働いています。まだ始めたばかりですが、楽しい時間をご一緒できるようにがんばります。甘いものが好きです。', '{恵比寿}', '{カフェ,食事}', 'open', 50),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'ゆっくりお話ししましょう', '銀座のお店に勤めています。読書と紅茶が好き。落ち着いた雰囲気のカフェでお話しするのが理想です。', '{銀座}', '{カフェ}', 'select', 40)
) v(id, headline, bio, areas, plans, mode, review)
where w.user_id = v.id;

insert into public.venue_references (woman_id, venue_name, area, is_public, verify_status, verified_at) values
  ('b0000000-0000-4000-8000-000000000001', 'Lounge Aurum（デモ店舗）', '銀座', true, 'approved', now()),
  ('b0000000-0000-4000-8000-000000000002', 'Club Lumière（デモ店舗）', '六本木', true, 'approved', now()),
  ('b0000000-0000-4000-8000-000000000003', 'Bar Sakura（デモ店舗）', '新宿', false, 'pending', null),
  ('b0000000-0000-4000-8000-000000000004', 'Salon Hinoki（デモ店舗）', '渋谷', false, 'approved', now());

insert into public.profile_photos (user_id, storage_path, sort_order, status)
select ('b0000000-0000-4000-8000-00000000000' || w)::uuid, format('demo/w%s-%s.svg', w, n), n - 1, 'approved'
from generate_series(1, 6) w, generate_series(1, 3) n;
insert into public.profile_photos (user_id, storage_path, sort_order, status) values
  ('c0000000-0000-4000-8000-000000000001', 'demo/m1-1.svg', 0, 'approved'),
  ('c0000000-0000-4000-8000-000000000002', 'demo/m2-1.svg', 0, 'approved');

update public.men_profiles set bio = '都内で会社を経営しています。おいしいお店でゆっくり話すのが好きです。' where user_id = 'c0000000-0000-4000-8000-000000000001';
update public.men_profiles set bio = '外資系勤務。ワインと旅行が趣味です。よろしくお願いします。' where user_id = 'c0000000-0000-4000-8000-000000000002';
update public.profiles set area = '港区' where id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');

-- 健一: GOLD プラン（サンドボックス）
insert into public.payments (id, user_id, kind, plan_code, amount, status, provider, is_sandbox, captured_at, note)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'subscription', 'GOLD', 14800, 'captured', 'sandbox', true, now(), 'デモ');
insert into public.membership_entitlements (user_id, plan_code, current_period_end, source, external_ref)
values ('c0000000-0000-4000-8000-000000000002', 'GOLD', now() + interval '30 days', 'sandbox', 'd0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- past history（アプリ内実績のデモ）
create or replace function pg_temp.demo_history(p_woman uuid, p_man uuid, p_count int, p_price int) returns void
language plpgsql as $$
declare i int; b uuid; pay uuid; fee int := round(p_price * 0.2);
begin
  for i in 1..p_count loop
    insert into public.bookings (man_id, woman_id, start_at, end_at, area, plan_type, price, status, accepted_at, completed_at, created_at)
      values (p_man, p_woman, now() - make_interval(days => 3 + i * 3, hours => 2), now() - make_interval(days => 3 + i * 3),
              '銀座', '食事', p_price, 'completed', now() - make_interval(days => 5 + i * 3), now() - make_interval(days => 3 + i * 3),
              now() - make_interval(days => 6 + i * 3))
      returning id into b;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, note) values
      (b, null, 'requested', p_man, 'seed'), (b, 'requested', 'accepted', p_woman, 'seed'), (b, 'accepted', 'completed', p_woman, 'seed');
    insert into public.payments (user_id, kind, booking_id, amount, status, provider, is_sandbox, captured_at, note)
      values (p_man, 'booking', b, p_price, 'captured', 'sandbox', true, now() - make_interval(days => 3 + i * 3), 'デモ実績') returning id into pay;
    insert into public.earnings_ledger (woman_id, booking_id, payment_id, entry_type, gross, fee, net, is_sandbox, created_at)
      values (p_woman, b, pay, 'earning', p_price, fee, p_price - fee, true, now() - make_interval(days => 3 + i * 3));
  end loop;
  insert into public.conversations (man_id, woman_id) values (p_man, p_woman) on conflict do nothing;
end $$;

select pg_temp.demo_history('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 12, 30000);
select pg_temp.demo_history('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 4, 25000);
insert into public.applications (man_id, woman_id, status, source, decided_at) values
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'approved', 'invite', now() - interval '50 days'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'approved', 'request', now() - interval '20 days');
insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, c.woman_id, '先日はありがとうございました。またお話しできるのを楽しみにしています。', now() - interval '3 days'
from public.conversations c where c.man_id = 'c0000000-0000-4000-8000-000000000003';
update public.conversations set last_message_at = now() - interval '3 days' where man_id = 'c0000000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------- upcoming slots (JST 19:00-21:00 / 15:00-16:30)
insert into public.availability_slots (woman_id, start_at, end_at, area, plan_type, price, note)
select w.id, (((date_trunc('day', now() at time zone 'Asia/Tokyo') + make_interval(days => k)) + time '19:00') at time zone 'Asia/Tokyo'),
  (((date_trunc('day', now() at time zone 'Asia/Tokyo') + make_interval(days => k)) + time '21:00') at time zone 'Asia/Tokyo'),
  w.area, w.plan, w.price, '仮の料金設定（デモ）'
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, '銀座', '食事', 40000),
  ('b0000000-0000-4000-8000-000000000002'::uuid, '六本木', '食事', 32000),
  ('b0000000-0000-4000-8000-000000000003'::uuid, '新宿', '食事', 22000),
  ('b0000000-0000-4000-8000-000000000004'::uuid, '渋谷', 'バー同席', 22000),
  ('b0000000-0000-4000-8000-000000000005'::uuid, '恵比寿', '食事', 15000),
  ('b0000000-0000-4000-8000-000000000006'::uuid, '銀座', 'カフェ', 15000)) w(id, area, plan, price),
  generate_series(1, 9, 2) k;

insert into public.availability_slots (woman_id, start_at, end_at, area, plan_type, price, note)
select w.id, (((date_trunc('day', now() at time zone 'Asia/Tokyo') + make_interval(days => k)) + time '15:00') at time zone 'Asia/Tokyo'),
  (((date_trunc('day', now() at time zone 'Asia/Tokyo') + make_interval(days => k)) + time '16:30') at time zone 'Asia/Tokyo'),
  w.area, 'カフェ', w.price, 'カフェでのお茶（デモ）'
from (values ('b0000000-0000-4000-8000-000000000003'::uuid, '新宿', 12000), ('b0000000-0000-4000-8000-000000000005'::uuid, '恵比寿', 9000),
             ('b0000000-0000-4000-8000-000000000006'::uuid, '銀座', 9000)) w(id, area, price),
  generate_series(2, 6, 2) k;

-- ---------------------------------------------------------------- compute ranks & levels
select public.recompute_user(id, 'seed') from public.profiles where role in ('woman', 'man');
