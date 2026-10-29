-- UI/UX 改善に伴う表示用データの追加（ロジック・権限は既存のまま）
--  * チャット: 相手との予約の状況・相手の既読位置
--  * 女性ホーム: 収益を「確定 / 予定 / 保留」に分けて返す、今月の完了件数、最上位ランク判定
--  * 管理ダッシュボード: 予約・決済・返金の状態別件数を同じ定義で返す

create or replace function public.pair_booking(p_man uuid, p_woman uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  -- 表示優先度: 確定済みの予定 > 承認待ち > 申立て中 > 直近のもの
  select jsonb_build_object('id', b.id, 'status', b.status, 'start_at', b.start_at, 'end_at', b.end_at)
  from public.bookings b
  where b.man_id = p_man and b.woman_id = p_woman
  order by case b.status when 'accepted' then 0 when 'requested' then 1 when 'disputed' then 2 else 3 end,
           case when b.status in ('accepted', 'requested') then b.start_at end asc nulls last,
           b.created_at desc
  limit 1
$$;
revoke execute on function public.pair_booking(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_messages(p_conversation uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); c public.conversations; last_id bigint; other uuid;
begin
  select * into c from public.conversations where id = p_conversation;
  if not found or uid not in (c.man_id, c.woman_id) or public.is_blocked_pair(c.man_id, c.woman_id) then
    perform public.raise_app('NOT_FOUND', 'メッセージが見つかりません');
  end if;
  other := case when c.man_id = uid then c.woman_id else c.man_id end;
  select max(id) into last_id from public.messages where conversation_id = p_conversation;
  if last_id is not null then
    insert into public.conversation_reads (conversation_id, user_id, last_read_id) values (p_conversation, uid, last_id)
      on conflict (conversation_id, user_id) do update set last_read_id = greatest(public.conversation_reads.last_read_id, excluded.last_read_id);
  end if;
  return jsonb_build_object(
    'can_chat', public.can_chat(p_conversation, uid),
    'counterpart', (select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'role', o.role, 'photos', public.photo_paths(o.id))
                    from public.profiles o where o.id = other),
    'counterpart_read_id', coalesce((select last_read_id from public.conversation_reads where conversation_id = p_conversation and user_id = other), 0),
    'booking', public.pair_booking(c.man_id, c.woman_id),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'created_at', m.created_at, 'mine', m.sender_id = uid)
                 order by m.id), '[]')
                 from (select * from public.messages where conversation_id = p_conversation and id > coalesce(p_after, 0)
                       order by id desc limit 200) m));
end $$;

create or replace function public.woman_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); w public.women_profiles; nxt record; month_start timestamptz;
  sb boolean := public.setting('payment_mode') #>> '{}' = 'sandbox'; fee numeric := public.setting_num('platform_fee_rate', 0.2);
  top_sort int;
begin
  select * into w from public.women_profiles where user_id = uid;
  month_start := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  select code, min_value into nxt from public.rank_rules where audience = 'woman' and min_value > w.rank_score order by min_value limit 1;
  select max(sort) into top_sort from public.rank_rules where audience = 'woman';
  return jsonb_build_object(
    'pending_applications', (select count(*) from public.applications where woman_id = uid and status = 'pending'),
    'pending_bookings', (select count(*) from public.bookings where woman_id = uid and status = 'requested'),
    -- 確定: 完了して台帳に記録された報酬（返金の取消を含む）
    'month_net', (select coalesce(sum(net), 0) from public.earnings_ledger where woman_id = uid and created_at >= month_start
                  and entry_type in ('earning', 'reversal') and is_sandbox = sb),
    'month_completed', (select count(*) from public.bookings where woman_id = uid and status = 'completed' and completed_at >= month_start),
    'total_net', public.woman_earnings_net(uid),
    -- 予定: 承認済み（予約確定）で未完了の予約の見込み額（手数料控除後）。まだ確定していない
    'expected_net', (select coalesce(sum(price - round(price * fee)), 0)::int from public.bookings where woman_id = uid and status = 'accepted'),
    'expected_count', (select count(*) from public.bookings where woman_id = uid and status = 'accepted'),
    -- 保留: 申立て中の予約（運営の判断待ち）
    'held_net', (select coalesce(sum(price - round(price * fee)), 0)::int from public.bookings where woman_id = uid and status = 'disputed'),
    'held_count', (select count(*) from public.bookings where woman_id = uid and status = 'disputed'),
    'is_sandbox', sb,
    'upcoming', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'start_at', b.start_at, 'end_at', b.end_at, 'area', b.area,
                 'plan_type', b.plan_type, 'man_name', p.display_name) order by b.start_at), '[]')
                 from public.bookings b join public.profiles p on p.id = b.man_id
                 where b.woman_id = uid and b.status = 'accepted'),
    'rank_code', w.rank_code, 'rank_score', w.rank_score,
    'is_top_rank', public.rank_sort('woman', w.rank_code) >= coalesce(top_sort, 0),
    'next_rank', case when nxt.code is not null then jsonb_build_object('code', nxt.code, 'min_value', nxt.min_value) end,
    'rank_floor', (select min_value from public.rank_rules where audience = 'woman' and code = w.rank_code),
    'rank_breakdown', (select breakdown - 'weights' from public.rank_snapshots where user_id = uid and audience = 'woman' order by computed_at desc limit 1),
    'level', w.level, 'xp', w.xp, 'level_floor_xp', public.xp_for_level(w.level), 'next_level_xp', public.xp_for_level(w.level + 1),
    'completed', public.completed_count(uid),
    'is_published', w.is_published, 'accept_mode', w.accept_mode, 'accept_requests', w.accept_requests,
    'badges', public.badges(uid));
end $$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare decided int; ok int; sb boolean := public.setting('payment_mode') #>> '{}' = 'sandbox';
begin
  perform public.require_admin();
  -- 成立率 = (予約確定 + 完了) ÷ 女性が判断済みの申込（確定・完了・不成立・申立て）。申込者による取り下げ・キャンセルは分母から除外
  select count(*) filter (where status in ('accepted', 'completed', 'declined', 'disputed')),
         count(*) filter (where status in ('accepted', 'completed', 'disputed'))
    into decided, ok from public.bookings;
  return jsonb_build_object(
    'users', (select jsonb_build_object(
       'total', count(*) filter (where role <> 'admin'),
       'women', count(*) filter (where role = 'woman'), 'men', count(*) filter (where role = 'man'),
       'suspended', count(*) filter (where status = 'suspended'),
       'deletion_requested', count(*) filter (where status = 'deletion_requested'),
       'new_7d', count(*) filter (where role <> 'admin' and created_at > now() - interval '7 days')) from public.profiles),
    'verification_pending', (select count(*) from public.verification_states where status = 'pending'),
    'venue_pending', (select count(*) from public.venue_references where verify_status = 'pending'),
    'photos_pending', (select count(*) from public.profile_photos where status = 'pending'),
    'applications', (select jsonb_build_object('total', count(*), 'pending', count(*) filter (where status = 'pending'),
                     'approved', count(*) filter (where status = 'approved')) from public.applications),
    'bookings', (select jsonb_build_object(
       'requested', count(*) filter (where status = 'requested'), 'accepted', count(*) filter (where status = 'accepted'),
       'completed', count(*) filter (where status = 'completed'), 'declined', count(*) filter (where status = 'declined'),
       'canceled', count(*) filter (where status = 'canceled'), 'disputed', count(*) filter (where status = 'disputed')) from public.bookings),
    'booking_total', (select count(*) from public.bookings),
    'success_rate', case when decided > 0 then round(ok::numeric / decided * 100, 1) else null end,
    'payments', (select jsonb_build_object(
       'authorized', count(*) filter (where status = 'authorized'), 'captured', count(*) filter (where status = 'captured'),
       'voided', count(*) filter (where status = 'voided'), 'refunded', count(*) filter (where status = 'refunded'))
       from public.payments where is_sandbox = sb),
    'revenue', (select jsonb_build_object(
       'subscription', coalesce(sum(amount) filter (where kind = 'subscription' and status = 'captured'), 0),
       'booking_gross', coalesce(sum(amount) filter (where kind = 'booking' and status in ('captured', 'refunded')), 0),
       'refunded', coalesce((select sum(r.amount) from public.refunds r join public.payments p2 on p2.id = r.payment_id
                             where r.status = 'processed' and p2.is_sandbox = sb), 0))
       from public.payments where is_sandbox = sb),
    'platform_fee', (select coalesce(sum(fee), 0) from public.earnings_ledger where is_sandbox = sb),
    'reports_open', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'disputes_open', (select count(*) from public.bookings where status = 'disputed'),
    'refunds_open', (select count(*) from public.refunds where status = 'requested'),
    'inquiries_open', (select count(*) from public.inquiries where status = 'open'),
    'is_sandbox', sb,
    'payment_mode', public.setting('payment_mode'));
end $$;
