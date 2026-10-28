-- 一般ユーザー向け RPC。すべて security definer で、関数内で本人・役割・状態を検証する。

-- ---------------------------------------------------------------- builders
create or replace function public.photo_paths(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(storage_path order by sort_order, created_at), '[]')
  from public.profile_photos where user_id = p_user and status = 'approved'
$$;

create or replace function public.public_venue(p_woman uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', venue_name, 'area', area) from public.venue_references
  where woman_id = p_woman and is_public and verify_status = 'approved'
$$;

create or replace function public.woman_card(p_woman uuid, p_viewer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare w public.women_profiles; p public.profiles; v_next jsonb; acc jsonb;
begin
  select * into w from public.women_profiles where user_id = p_woman;
  select * into p from public.profiles where id = p_woman;
  select jsonb_build_object('start_at', start_at, 'end_at', end_at, 'price', price, 'plan_type', plan_type)
    into v_next from public.availability_slots
    where woman_id = p_woman and status = 'open' and start_at > now() order by start_at limit 1;
  acc := case when p_viewer is not null and public.my_role() = 'man' then public.man_access(p_viewer) end;
  return jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'headline', w.headline, 'area', p.area, 'areas', to_jsonb(w.areas),
    'rank_code', w.rank_code, 'level', w.level, 'accept_mode', w.accept_mode, 'accept_requests', w.accept_requests,
    'plan_types', to_jsonb(w.plan_types), 'photos', public.photo_paths(p_woman), 'venue', public.public_venue(p_woman),
    'next_slot', v_next,
    'locked', case when acc is null then false
                   else public.rank_sort('woman', w.rank_code) > (acc ->> 'unlocked_sort')::int
                        and not exists (select 1 from public.applications a where a.man_id = p_viewer and a.woman_id = p_woman
                                        and a.status = 'approved' and a.source = 'invite') end);
end $$;

-- 女性に見せる男性情報（利用額・支払額は含めない）
create or replace function public.man_summary(p_man uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'area', p.area, 'level', m.level,
    'bio', m.bio, 'verified', coalesce(v.status = 'approved', false), 'completed', public.completed_count(p.id),
    'photos', public.photo_paths(p.id), 'joined_at', p.created_at)
  from public.profiles p join public.men_profiles m on m.user_id = p.id
  left join public.verification_states v on v.user_id = p.id where p.id = p_man
$$;

create or replace function public.badges(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b jsonb := '[]'; done int := public.completed_count(p_user); verified boolean; n_photos int;
begin
  select status = 'approved' into verified from public.verification_states where user_id = p_user;
  select count(*) into n_photos from public.profile_photos where user_id = p_user and status = 'approved';
  b := b || jsonb_build_object('code', 'verified', 'label', '本人確認済み', 'earned', coalesce(verified, false));
  b := b || jsonb_build_object('code', 'first', 'label', 'はじめての予約完了', 'earned', done >= 1);
  b := b || jsonb_build_object('code', 'five', 'label', '予約完了 5回', 'earned', done >= 5);
  b := b || jsonb_build_object('code', 'safe', 'label', 'トラブルなし（3回以上完了）', 'earned', done >= 3 and public.actioned_reports(p_user) = 0);
  if (select role from public.profiles where id = p_user) = 'woman' then
    b := b || jsonb_build_object('code', 'profile', 'label', '写真3枚以上', 'earned', n_photos >= 3);
  end if;
  return b;
end $$;

create or replace function public.ensure_conversation(p_man uuid, p_woman uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  insert into public.conversations (man_id, woman_id) values (p_man, p_woman)
    on conflict (man_id, woman_id) do nothing;
  select id into v from public.conversations where man_id = p_man and woman_id = p_woman;
  return v;
end $$;

create or replace function public.can_chat(p_conversation uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    join public.profiles pm on pm.id = c.man_id join public.profiles pw on pw.id = c.woman_id
    where c.id = p_conversation and p_user in (c.man_id, c.woman_id)
      and pm.status = 'active' and pw.status = 'active'
      and not public.is_blocked_pair(c.man_id, c.woman_id)
      and (exists (select 1 from public.applications a where a.man_id = c.man_id and a.woman_id = c.woman_id and a.status = 'approved')
        or exists (select 1 from public.bookings b where b.man_id = c.man_id and b.woman_id = c.woman_id
                   and b.status in ('accepted', 'completed', 'disputed'))))
$$;

-- ---------------------------------------------------------------- me / settings
create or replace function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}') from public.app_settings where is_public),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name, 'monthly_price', monthly_price,
              'unlock_rank', unlock_rank, 'perks', perks, 'is_demo_price', is_demo_price) order by sort), '[]')
              from public.membership_plans where is_active),
    'rank_rules', (select coalesce(jsonb_agg(jsonb_build_object('audience', audience, 'code', code, 'label', label,
              'min_value', min_value, 'sort', sort) order by audience, sort), '[]') from public.rank_rules))
$$;

create or replace function public.get_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; v public.verification_states; r jsonb; w public.women_profiles; m public.men_profiles;
begin
  if uid is null then perform public.raise_app('AUTH_REQUIRED', 'ログインが必要です'); end if;
  select * into p from public.profiles where id = uid;
  if not found then perform public.raise_app('AUTH_REQUIRED', 'プロフィールが見つかりません'); end if;
  update public.profiles set last_seen_at = now() where id = uid;
  select * into v from public.verification_states where user_id = uid;
  r := jsonb_build_object(
    'id', p.id, 'role', p.role, 'display_name', p.display_name, 'area', p.area, 'status', p.status,
    'status_reason', p.status_reason, 'created_at', p.created_at,
    'verification', jsonb_build_object('status', coalesce(v.status, 'unsubmitted'), 'method', v.method,
       'submitted_at', v.submitted_at, 'rejection_reason', v.rejection_reason),
    'photos', public.photo_paths(uid),
    'photo_items', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', storage_path, 'status', status) order by sort_order, created_at), '[]')
                    from public.profile_photos where user_id = uid),
    'unread_notifications', (select count(*) from public.notifications where user_id = uid and read_at is null),
    'badges', public.badges(uid));
  if p.role = 'woman' then
    select * into w from public.women_profiles where user_id = uid;
    r := r || jsonb_build_object('woman', jsonb_build_object(
      'headline', w.headline, 'bio', w.bio, 'areas', to_jsonb(w.areas), 'plan_types', to_jsonb(w.plan_types),
      'accept_mode', w.accept_mode, 'accept_requests', w.accept_requests, 'min_man_level', w.min_man_level,
      'ng_note', w.ng_note, 'is_published', w.is_published, 'rank_code', w.rank_code, 'rank_score', w.rank_score,
      'xp', w.xp, 'level', w.level, 'level_floor_xp', public.xp_for_level(w.level), 'next_level_xp', public.xp_for_level(w.level + 1),
      'venue', (select jsonb_build_object('id', id, 'name', venue_name, 'area', area, 'is_public', is_public, 'verify_status', verify_status)
                from public.venue_references where woman_id = uid)));
  elsif p.role = 'man' then
    select * into m from public.men_profiles where user_id = uid;
    r := r || jsonb_build_object('man', jsonb_build_object(
      'bio', m.bio, 'spend_total', m.spend_total, 'spend_rank', m.spend_rank_code, 'xp', m.xp, 'level', m.level,
      'level_floor_xp', public.xp_for_level(m.level), 'next_level_xp', public.xp_for_level(m.level + 1)),
      'access', public.man_access(uid),
      'entitlement', (select jsonb_build_object('plan_code', plan_code, 'status', status, 'current_period_end', current_period_end,
                      'cancel_at_period_end', cancel_at_period_end, 'source', source)
                      from public.membership_entitlements where user_id = uid and status = 'active' limit 1));
  end if;
  return r;
end $$;

create or replace function public.update_my_profile(p_display_name text, p_area text, p_bio text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then perform public.raise_app('INVALID', '表示名を入力してください'); end if;
  perform public.assert_clean_text(p_display_name || ' ' || coalesce(p_bio, ''));
  update public.profiles set display_name = left(trim(p_display_name), 30), area = left(coalesce(p_area, ''), 30), updated_at = now()
    where id = uid;
  if public.my_role() = 'man' then
    update public.men_profiles set bio = left(coalesce(p_bio, ''), 500), updated_at = now() where user_id = uid;
  elsif public.my_role() = 'woman' then
    update public.women_profiles set bio = left(coalesce(p_bio, ''), 1000), updated_at = now() where user_id = uid;
  end if;
  perform public.recompute_user(uid, 'profile_updated');
  return public.get_me();
end $$;

create or replace function public.submit_verification(p_birth_year int, p_consent boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); cur public.verification_status; min_age int := public.setting_num('min_age', 20)::int;
  auto boolean := public.setting_bool('demo_auto_verify');
begin
  if not coalesce(p_consent, false) then perform public.raise_app('INVALID', '規約への同意が必要です'); end if;
  if p_birth_year is null or p_birth_year < 1900 then perform public.raise_app('INVALID', '生年を正しく入力してください'); end if;
  -- 生年のみで判定するため保守的に「満年齢が確実に min_age 以上」の場合のみ受け付ける
  if extract(year from now() at time zone 'Asia/Tokyo')::int - p_birth_year <= min_age then
    perform public.raise_app('AGE_RESTRICTED', format('%s歳以上の方のみご利用いただけます', min_age));
  end if;
  select status into cur from public.verification_states where user_id = uid;
  if cur = 'approved' then perform public.raise_app('INVALID', '本人確認は完了しています'); end if;
  update public.verification_states set status = (case when auto then 'approved' else 'pending' end)::public.verification_status, method = 'demo',
    birth_year = p_birth_year, submitted_at = now(), reviewed_at = case when auto then now() end, rejection_reason = null
    where user_id = uid;
  perform public.audit('verification.submit', 'user', uid::text, jsonb_build_object('auto', auto));
  perform public.recompute_user(uid, 'verification');
  return public.get_me();
end $$;

-- ---------------------------------------------------------------- notifications
create or replace function public.list_notifications(p_limit int default 50) returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(n) - 'user_id' order by n.id desc), '[]') from (
    select * from public.notifications where user_id = auth.uid() order by id desc limit least(coalesce(p_limit, 50), 200)) n
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- ---------------------------------------------------------------- men: browse
create or replace function public.search_women(p_area text default null, p_rank text default null, p_date date default null,
  p_open_only boolean default false, p_query text default null, p_limit int default 30, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); r public.user_role := public.my_role();
begin
  if r not in ('man', 'admin') then perform public.raise_app('FORBIDDEN', 'この操作は許可されていません'); end if;
  return (select coalesce(jsonb_agg(public.woman_card(x.user_id, uid) order by x.has_slot desc, x.next_at nulls last, x.updated_at desc), '[]')
    from (
      select w.user_id, w.updated_at,
        (select min(s.start_at) from public.availability_slots s where s.woman_id = w.user_id and s.status = 'open' and s.start_at > now()) as next_at,
        exists (select 1 from public.availability_slots s where s.woman_id = w.user_id and s.status = 'open' and s.start_at > now()) as has_slot
      from public.women_profiles w
      join public.profiles p on p.id = w.user_id
      join public.verification_states v on v.user_id = w.user_id and v.status = 'approved'
      where w.is_published and p.status = 'active'
        and not public.is_blocked_pair(uid, w.user_id)
        and (p_area is null or p_area = '' or p.area = p_area or p_area = any (w.areas))
        and (p_rank is null or p_rank = '' or w.rank_code = p_rank)
        and (not coalesce(p_open_only, false) or (w.accept_requests and w.accept_mode = 'open'))
        and (p_query is null or p_query = '' or p.display_name ilike '%' || p_query || '%' or w.headline ilike '%' || p_query || '%')
        and (p_date is null or exists (select 1 from public.availability_slots s where s.woman_id = w.user_id and s.status = 'open'
             and (s.start_at at time zone 'Asia/Tokyo')::date = p_date))
      order by has_slot desc, next_at nulls last, w.updated_at desc
      limit least(coalesce(p_limit, 30), 100) offset greatest(coalesce(p_offset, 0), 0)) x);
end $$;

create or replace function public.get_woman_detail(p_woman uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); r public.user_role := public.my_role(); w public.women_profiles; card jsonb;
begin
  if r not in ('man', 'admin') and uid <> p_woman then perform public.raise_app('FORBIDDEN', 'この操作は許可されていません'); end if;
  select * into w from public.women_profiles where user_id = p_woman;
  if not found or (r = 'man' and (public.is_blocked_pair(uid, p_woman) or not w.is_published
      or (select status from public.profiles where id = p_woman) <> 'active')) then
    perform public.raise_app('NOT_FOUND', 'プロフィールが見つかりません');
  end if;
  card := public.woman_card(p_woman, uid);
  return card || jsonb_build_object(
    'bio', w.bio,
    'slots', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at, 'area', s.area,
               'plan_type', s.plan_type, 'price', s.price, 'note', s.note,
               'my_request', (select b.status from public.bookings b where b.slot_id = s.id and b.man_id = uid order by b.created_at desc limit 1))
               order by s.start_at), '[]')
              from public.availability_slots s where s.woman_id = p_woman and s.status = 'open' and s.start_at > now()
                and s.start_at < now() + interval '30 days'),
    'eligibility', case when r = 'man' then public.eligibility(uid, p_woman) end,
    'conversation_id', (select c.id from public.conversations c where c.man_id = uid and c.woman_id = p_woman and public.can_chat(c.id, uid)),
    'badges', (select jsonb_agg(b) from jsonb_array_elements(public.badges(p_woman)) b where (b ->> 'earned')::boolean));
end $$;

-- ---------------------------------------------------------------- men: membership (sandbox)
create or replace function public.membership_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); m public.men_profiles; nxt record;
begin
  select * into m from public.men_profiles where user_id = uid;
  select code, min_value into nxt from public.rank_rules where audience = 'man_spend' and min_value > m.spend_total order by min_value limit 1;
  return jsonb_build_object(
    'payment_mode', public.setting('payment_mode'),
    'plans', (public.get_public_settings()) -> 'plans',
    'rank_rules', (select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'min_value', min_value, 'sort', sort) order by sort)
                   from public.rank_rules where audience = 'man_spend'),
    'access', public.man_access(uid),
    'entitlement', (select jsonb_build_object('plan_code', plan_code, 'status', status, 'current_period_end', current_period_end,
                    'cancel_at_period_end', cancel_at_period_end, 'source', source)
                    from public.membership_entitlements where user_id = uid and status = 'active' limit 1),
    'spend_total', m.spend_total, 'spend_rank', m.spend_rank_code,
    'next_spend_rank', case when nxt.code is not null then jsonb_build_object('code', nxt.code, 'min_value', nxt.min_value) end,
    'level', m.level, 'xp', m.xp, 'level_floor_xp', public.xp_for_level(m.level), 'next_level_xp', public.xp_for_level(m.level + 1),
    'badges', public.badges(uid),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'amount', amount, 'status', status,
                 'is_sandbox', is_sandbox, 'plan_code', plan_code, 'booking_id', booking_id, 'created_at', created_at) order by created_at desc), '[]')
                 from (select * from public.payments where user_id = uid order by created_at desc limit 30) p));
end $$;

create or replace function public.assert_sandbox() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.setting('payment_mode') #>> '{}' <> 'sandbox' then
    perform public.raise_app('LIVE_PAYMENTS_NOT_CONFIGURED',
      '本番決済は未設定です。決済事業者の審査・契約完了後に有効化されます');
  end if;
end $$;

create or replace function public.sandbox_subscribe(p_plan text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); pl public.membership_plans; pay uuid;
begin
  perform public.assert_sandbox();
  select * into pl from public.membership_plans where code = p_plan and is_active;
  if not found then perform public.raise_app('NOT_FOUND', 'プランが見つかりません'); end if;
  update public.membership_entitlements set status = 'canceled', updated_at = now() where user_id = uid and status = 'active';
  if pl.monthly_price > 0 then
    insert into public.payments (user_id, kind, plan_code, amount, status, provider, is_sandbox, captured_at, note)
      values (uid, 'subscription', pl.code, pl.monthly_price, 'captured', 'sandbox', true, now(), 'サンドボックス疑似決済')
      returning id into pay;
    insert into public.membership_entitlements (user_id, plan_code, current_period_end, source, external_ref)
      values (uid, pl.code, now() + interval '30 days', 'sandbox', pay::text);
  end if;
  perform public.audit('membership.subscribe', 'user', uid::text, jsonb_build_object('plan', pl.code, 'sandbox', true));
  perform public.notify(uid, 'membership', format('%s プランに変更しました（デモ）', pl.name),
    'サンドボックスの疑似決済です。実際の請求は発生していません。', '/membership');
  perform public.recompute_man(uid, 'membership_changed');
  return public.membership_overview();
end $$;

create or replace function public.cancel_subscription() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man');
begin
  update public.membership_entitlements set cancel_at_period_end = true, updated_at = now() where user_id = uid and status = 'active';
  if not found then perform public.raise_app('NOT_FOUND', '有効なプランがありません'); end if;
  perform public.audit('membership.cancel', 'user', uid::text, '{}');
  return public.membership_overview();
end $$;

create or replace function public.resume_subscription() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man');
begin
  update public.membership_entitlements set cancel_at_period_end = false, updated_at = now() where user_id = uid and status = 'active';
  return public.membership_overview();
end $$;

-- ---------------------------------------------------------------- men: apply / request
create or replace function public.submit_application(p_woman uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); e jsonb; v uuid;
begin
  e := public.eligibility(uid, p_woman);
  if not (e ->> 'can_apply')::boolean then
    perform public.raise_app('NOT_ELIGIBLE', coalesce(e -> 'reasons' -> 0 ->> 'message', '現在申請できません'));
  end if;
  perform public.assert_clean_text(p_message);
  insert into public.applications (man_id, woman_id, message) values (uid, p_woman, left(coalesce(p_message, ''), 500)) returning id into v;
  perform public.notify(p_woman, 'application', '新しいプロフィール申請があります',
    (select display_name from public.profiles where id = uid) || ' さんから申請が届きました', '/w/requests');
  return jsonb_build_object('id', v, 'status', 'pending');
end $$;

create or replace function public.request_booking(p_slot uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); s public.availability_slots; e jsonb; v uuid;
begin
  select * into s from public.availability_slots where id = p_slot for update;
  if not found or s.status <> 'open' then perform public.raise_app('SLOT_UNAVAILABLE', 'この枠は現在受付していません'); end if;
  if s.start_at <= now() then perform public.raise_app('SLOT_UNAVAILABLE', '開始時刻を過ぎた枠には申し込めません'); end if;
  e := public.eligibility(uid, s.woman_id);
  if not (e ->> 'can_request')::boolean then
    perform public.raise_app(coalesce(e -> 'reasons' -> 0 ->> 'code', 'NOT_ELIGIBLE'),
      coalesce(e -> 'reasons' -> 0 ->> 'message', '現在申し込みできません'));
  end if;
  perform public.assert_clean_text(p_message);
  if exists (select 1 from public.bookings where slot_id = p_slot and man_id = uid and status in ('requested', 'accepted')) then
    perform public.raise_app('DUPLICATE', 'この枠には申し込み済みです');
  end if;
  if exists (select 1 from public.bookings where man_id = uid and status = 'accepted'
             and tstzrange(start_at, end_at) && tstzrange(s.start_at, s.end_at)) then
    perform public.raise_app('BOOKING_CONFLICT', '同じ時間帯に確定済みの予約があります');
  end if;
  -- 価格・日時はサーバー側の枠情報から確定（クライアント値は使わない）
  insert into public.bookings (man_id, woman_id, slot_id, start_at, end_at, area, plan_type, price, man_message)
    values (uid, s.woman_id, s.id, s.start_at, s.end_at, s.area, s.plan_type, s.price, left(coalesce(p_message, ''), 500))
    returning id into v;
  insert into public.booking_events (booking_id, from_status, to_status, actor_id) values (v, null, 'requested', uid);
  perform public.notify(s.woman_id, 'booking', '新しい予約申請があります',
    (select display_name from public.profiles where id = uid) || ' さんから ' ||
    to_char(s.start_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' の申請が届きました', '/booking/' || v);
  return jsonb_build_object('id', v, 'status', 'requested');
end $$;

create or replace function public.redeem_share_link(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); l public.share_links;
begin
  select * into l from public.share_links where code = p_code and is_active;
  if not found then perform public.raise_app('NOT_FOUND', 'この招待リンクは無効です'); end if;
  if public.is_blocked_pair(uid, l.woman_id) then perform public.raise_app('NOT_FOUND', 'この招待リンクは無効です'); end if;
  insert into public.applications (man_id, woman_id, status, source, decided_at)
    values (uid, l.woman_id, 'approved', 'invite', now())
    on conflict (man_id, woman_id) do update set status = 'approved', source = 'invite', decided_at = now();
  perform public.ensure_conversation(uid, l.woman_id);
  update public.share_links set uses = uses + 1 where id = l.id;
  perform public.notify(l.woman_id, 'invite', '招待リンクからの登録がありました',
    (select display_name from public.profiles where id = uid) || ' さんがあなたのプロフィールに参加しました', '/w/requests');
  return jsonb_build_object('woman_id', l.woman_id);
end $$;

create or replace function public.get_share_link_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('woman_id', l.woman_id, 'display_name', p.display_name, 'headline', w.headline)
  from public.share_links l join public.profiles p on p.id = l.woman_id join public.women_profiles w on w.user_id = l.woman_id
  where l.code = p_code and l.is_active and p.status = 'active'
$$;

-- ---------------------------------------------------------------- women: profile & settings
create or replace function public.update_woman_profile(p_display_name text, p_area text, p_headline text, p_bio text,
  p_areas text[], p_plan_types text[], p_is_published boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then perform public.raise_app('INVALID', '表示名を入力してください'); end if;
  perform public.assert_clean_text(concat_ws(' ', p_display_name, p_headline, p_bio, array_to_string(p_areas, ' '), array_to_string(p_plan_types, ' ')));
  if p_is_published and (select status from public.verification_states where user_id = uid) <> 'approved' then
    perform public.raise_app('VERIFY_REQUIRED', 'プロフィールの公開には本人確認の完了が必要です');
  end if;
  if p_is_published and not exists (select 1 from public.profile_photos where user_id = uid and status = 'approved') then
    perform public.raise_app('PHOTO_REQUIRED', 'プロフィールの公開には写真が1枚以上必要です');
  end if;
  update public.profiles set display_name = left(trim(p_display_name), 30), area = left(coalesce(p_area, ''), 30), updated_at = now() where id = uid;
  update public.women_profiles set headline = left(coalesce(p_headline, ''), 60), bio = left(coalesce(p_bio, ''), 1000),
    areas = coalesce(p_areas[1:5], '{}'), plan_types = coalesce(p_plan_types[1:6], '{}'), is_published = coalesce(p_is_published, false),
    updated_at = now() where user_id = uid;
  perform public.recompute_woman(uid, 'profile_updated');
  return public.get_me();
end $$;

create or replace function public.set_accept_settings(p_accept_mode public.accept_mode, p_accept_requests boolean,
  p_min_man_level int, p_ng_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  update public.women_profiles set accept_mode = p_accept_mode, accept_requests = coalesce(p_accept_requests, true),
    min_man_level = greatest(1, least(coalesce(p_min_man_level, 1), 50)), ng_note = left(coalesce(p_ng_note, ''), 500), updated_at = now()
    where user_id = uid;
  perform public.audit('woman.accept_settings', 'user', uid::text, jsonb_build_object('mode', p_accept_mode, 'accept', p_accept_requests));
  return public.get_me();
end $$;

create or replace function public.upsert_venue(p_name text, p_area text, p_is_public boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  if char_length(trim(coalesce(p_name, ''))) = 0 then perform public.raise_app('INVALID', '店舗名を入力してください'); end if;
  perform public.assert_clean_text(p_name);
  insert into public.venue_references (woman_id, venue_name, area, is_public)
    values (uid, left(trim(p_name), 60), left(coalesce(p_area, ''), 30), coalesce(p_is_public, false))
    on conflict (woman_id) do update set
      verify_status = case when public.venue_references.venue_name = excluded.venue_name then public.venue_references.verify_status else 'pending' end,
      venue_name = excluded.venue_name, area = excluded.area, is_public = excluded.is_public;
  perform public.recompute_woman(uid, 'venue_updated');
  return public.get_me();
end $$;

create or replace function public.delete_venue() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  delete from public.venue_references where woman_id = uid;
  perform public.recompute_woman(uid, 'venue_deleted');
  return public.get_me();
end $$;

create or replace function public.add_photo(p_path text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); n int; mx int;
begin
  if p_path is null or split_part(p_path, '/', 1) <> uid::text or p_path like '%..%' then
    perform public.raise_app('INVALID', '画像のパスが不正です');
  end if;
  mx := case when public.my_role() = 'woman' then 6 else 1 end;
  select count(*) into n from public.profile_photos where user_id = uid;
  if n >= mx then perform public.raise_app('LIMIT', format('写真は最大%s枚までです', mx)); end if;
  insert into public.profile_photos (user_id, storage_path, sort_order, status)
    values (uid, p_path, n, case when public.setting_bool('photo_auto_approve') then 'approved' else 'pending' end);
  perform public.recompute_user(uid, 'photo_added');
  return public.get_me();
end $$;

create or replace function public.delete_photo(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  delete from public.profile_photos where id = p_id and user_id = uid;
  if public.my_role() = 'woman' and not exists (select 1 from public.profile_photos where user_id = uid and status = 'approved') then
    update public.women_profiles set is_published = false where user_id = uid;
  end if;
  perform public.recompute_user(uid, 'photo_deleted');
  return public.get_me();
end $$;

create or replace function public.make_photo_primary(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  update public.profile_photos set sort_order = case when id = p_id then -1 else sort_order end where user_id = uid;
  with o as (select id, row_number() over (order by sort_order, created_at) - 1 as rn from public.profile_photos where user_id = uid)
  update public.profile_photos p set sort_order = o.rn from o where p.id = o.id;
  return public.get_me();
end $$;

create or replace function public.create_slot(p_start timestamptz, p_end timestamptz, p_area text, p_plan_type text,
  p_price int, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); v uuid;
begin
  if p_start <= now() then perform public.raise_app('INVALID', '開始日時は現在より後にしてください'); end if;
  if p_end <= p_start or p_end - p_start > interval '8 hours' then
    perform public.raise_app('INVALID', '終了時刻は開始より後、8時間以内にしてください');
  end if;
  if p_price is null or p_price < 0 or p_price > 1000000 then perform public.raise_app('INVALID', '希望料金が不正です'); end if;
  perform public.assert_clean_text(concat_ws(' ', p_area, p_plan_type, p_note));
  if exists (select 1 from public.availability_slots where woman_id = uid and status in ('open', 'booked')
             and tstzrange(start_at, end_at) && tstzrange(p_start, p_end)) then
    perform public.raise_app('SLOT_OVERLAP', '既存の枠と時間が重なっています');
  end if;
  insert into public.availability_slots (woman_id, start_at, end_at, area, plan_type, price, note)
    values (uid, p_start, p_end, left(coalesce(p_area, ''), 30), left(coalesce(p_plan_type, '食事'), 20), p_price, left(coalesce(p_note, ''), 300))
    returning id into v;
  return jsonb_build_object('id', v);
end $$;

create or replace function public.list_my_slots() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'start_at', s.start_at, 'end_at', s.end_at, 'area', s.area,
    'plan_type', s.plan_type, 'price', s.price, 'note', s.note, 'status', s.status,
    'pending_requests', (select count(*) from public.bookings b where b.slot_id = s.id and b.status = 'requested')) order by s.start_at), '[]')
  from public.availability_slots s where s.woman_id = auth.uid() and s.end_at > now() - interval '1 day' and s.status <> 'closed'
$$;

create or replace function public.close_slot(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); b record;
begin
  if exists (select 1 from public.bookings where slot_id = p_id and status = 'accepted') then
    perform public.raise_app('INVALID', '確定済みの予約がある枠は削除できません。予約をキャンセルしてください');
  end if;
  update public.availability_slots set status = 'closed' where id = p_id and woman_id = uid;
  if not found then perform public.raise_app('NOT_FOUND', '枠が見つかりません'); end if;
  for b in select id, man_id from public.bookings where slot_id = p_id and status = 'requested' loop
    update public.bookings set status = 'declined', decline_reason = '枠の受付が終了しました', updated_at = now() where id = b.id;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, note) values (b.id, 'requested', 'declined', uid, 'slot_closed');
    perform public.notify(b.man_id, 'booking', '予約申請が成立しませんでした', '枠の受付が終了しました', '/booking/' || b.id);
  end loop;
  return public.list_my_slots();
end $$;

-- ---------------------------------------------------------------- women: incoming & decisions
create or replace function public.list_incoming() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  return jsonb_build_object(
    'applications', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'message', a.message, 'status', a.status, 'source', a.source,
                     'created_at', a.created_at, 'man', public.man_summary(a.man_id)) order by a.created_at desc), '[]')
                     from public.applications a where a.woman_id = uid and a.status = 'pending' and not public.is_blocked_pair(uid, a.man_id)),
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'start_at', b.start_at, 'end_at', b.end_at, 'area', b.area,
                 'plan_type', b.plan_type, 'price', b.price, 'message', b.man_message, 'status', b.status, 'created_at', b.created_at,
                 'man', public.man_summary(b.man_id)) order by b.start_at), '[]')
                 from public.bookings b where b.woman_id = uid and b.status = 'requested' and not public.is_blocked_pair(uid, b.man_id)),
    'customers', (select coalesce(jsonb_agg(jsonb_build_object('man', public.man_summary(a.man_id), 'source', a.source,
                  'conversation_id', (select c.id from public.conversations c where c.man_id = a.man_id and c.woman_id = uid))
                  order by a.decided_at desc), '[]')
                  from public.applications a where a.woman_id = uid and a.status = 'approved' and not public.is_blocked_pair(uid, a.man_id)));
end $$;

create or replace function public.decide_application(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); a public.applications;
begin
  select * into a from public.applications where id = p_id and woman_id = uid for update;
  if not found or a.status <> 'pending' then perform public.raise_app('NOT_FOUND', '申請が見つかりません'); end if;
  update public.applications set status = case when p_approve then 'approved'::public.application_status else 'rejected' end,
    decided_at = now() where id = p_id;
  if p_approve then
    perform public.ensure_conversation(a.man_id, uid);
    perform public.notify(a.man_id, 'application', '申請が承認されました',
      (select display_name from public.profiles where id = uid) || ' さんへ予約申請・メッセージができるようになりました', '/woman/' || uid);
  else
    perform public.notify(a.man_id, 'application', '申請の結果のお知らせ', '今回はご希望に添えませんでした', null);
  end if;
  return public.list_incoming();
end $$;

create or replace function public.transition_booking(p_id uuid, p_to public.booking_status, p_note text default '') returns public.bookings
language plpgsql security definer set search_path = public as $$
declare b public.bookings; uid uuid := auth.uid(); ok boolean := false; adm boolean := public.is_admin(); prev public.booking_status;
begin
  select * into b from public.bookings where id = p_id for update;
  prev := b.status;
  if not found or not (uid in (b.man_id, b.woman_id) or adm) then perform public.raise_app('NOT_FOUND', '予約が見つかりません'); end if;
  ok := case
    when b.status = 'requested' and p_to in ('accepted', 'declined') then uid = b.woman_id
    when b.status = 'requested' and p_to = 'canceled' then uid in (b.man_id, b.woman_id) or adm
    when b.status = 'accepted' and p_to = 'canceled' then uid in (b.man_id, b.woman_id) or adm
    when b.status = 'accepted' and p_to = 'completed' then uid = b.woman_id or adm
    when b.status in ('accepted', 'completed') and p_to = 'disputed' then uid in (b.man_id, b.woman_id)
    when b.status = 'disputed' and p_to in ('completed', 'canceled') then adm
    else false end;
  if not ok then
    perform public.raise_app('INVALID_TRANSITION', format('この予約は「%s」から「%s」へ変更できません', b.status, p_to));
  end if;
  update public.bookings set status = p_to, updated_at = now(),
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end
    where id = p_id returning * into b;
  insert into public.booking_events (booking_id, from_status, to_status, actor_id, note)
    values (p_id, prev, p_to, uid, coalesce(p_note, ''));
  return b;
end $$;

create or replace function public.accept_booking(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); b public.bookings; other record; pay_status public.payment_status;
begin
  select * into b from public.bookings where id = p_id and woman_id = uid;
  if not found then perform public.raise_app('NOT_FOUND', '予約が見つかりません'); end if;
  if b.status <> 'requested' then perform public.raise_app('INVALID_TRANSITION', 'この申請はすでに処理されています'); end if;
  if public.is_blocked_pair(b.man_id, uid) or (select status from public.profiles where id = b.man_id) <> 'active' then
    perform public.raise_app('NOT_ELIGIBLE', 'このお相手の申請は承認できません');
  end if;
  if b.start_at <= now() then perform public.raise_app('INVALID', '開始時刻を過ぎた申請は承認できません'); end if;
  -- 同時承認による競合を直列化（女性・男性の両方でロック、順序固定でデッドロック回避）
  perform pg_advisory_xact_lock(hashtextextended(least(b.man_id::text, uid::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(b.man_id::text, uid::text), 0));
  if exists (select 1 from public.bookings x where x.id <> b.id and x.status = 'accepted'
             and (x.woman_id = uid or x.man_id = b.man_id) and tstzrange(x.start_at, x.end_at) && tstzrange(b.start_at, b.end_at)) then
    perform public.raise_app('BOOKING_CONFLICT', 'この時間帯は既に確定済みの予約と重なっているため承認できません');
  end if;
  if public.setting('payment_mode') #>> '{}' <> 'sandbox' then
    perform public.raise_app('LIVE_PAYMENTS_NOT_CONFIGURED', '本番決済が未設定のため予約を確定できません');
  end if;
  perform public.transition_booking(p_id, 'accepted', '');
  -- サンドボックス: 与信のみ（完了時に売上確定）
  insert into public.payments (user_id, kind, booking_id, amount, status, provider, is_sandbox, note)
    values (b.man_id, 'booking', b.id, b.price, 'authorized', 'sandbox', true, 'サンドボックス与信（実請求なし）');
  if b.slot_id is not null then
    update public.availability_slots set status = 'booked' where id = b.slot_id;
    for other in select id, man_id from public.bookings where slot_id = b.slot_id and status = 'requested' and id <> b.id loop
      update public.bookings set status = 'declined', decline_reason = 'この枠は他の予約で埋まりました', updated_at = now() where id = other.id;
      insert into public.booking_events (booking_id, from_status, to_status, actor_id, note) values (other.id, 'requested', 'declined', uid, 'slot_filled');
      perform public.notify(other.man_id, 'booking', '予約申請が成立しませんでした', 'この枠は他の予約で埋まりました', '/booking/' || other.id);
    end loop;
  end if;
  perform public.ensure_conversation(b.man_id, uid);
  perform public.notify(b.man_id, 'booking', '予約が確定しました',
    (select display_name from public.profiles where id = uid) || ' さんが ' ||
    to_char(b.start_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' の予約を承認しました', '/booking/' || b.id);
  return public.get_booking(p_id);
exception when exclusion_violation then
  perform public.raise_app('BOOKING_CONFLICT', 'この時間帯は既に確定済みの予約と重なっているため承認できません');
end $$;

create or replace function public.decline_booking(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); b public.bookings;
begin
  b := public.transition_booking(p_id, 'declined', coalesce(p_reason, ''));
  update public.bookings set decline_reason = left(coalesce(nullif(p_reason, ''), '今回はご希望に添えませんでした'), 200) where id = p_id;
  perform public.notify(b.man_id, 'booking', '予約申請の結果のお知らせ', '今回はご希望に添えませんでした', '/booking/' || b.id);
  return public.get_booking(p_id);
end $$;

create or replace function public.settle_booking_payment(p_booking uuid, p_capture_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments; b public.bookings; fee int;
begin
  select * into b from public.bookings where id = p_booking;
  select * into pay from public.payments where booking_id = p_booking and kind = 'booking' for update;
  if not found or pay.status <> 'authorized' then return; end if;
  if p_capture_amount <= 0 then
    update public.payments set status = 'voided', updated_at = now() where id = pay.id;
    return;
  end if;
  update public.payments set status = 'captured', amount = p_capture_amount, captured_at = now(), updated_at = now() where id = pay.id;
  fee := round(p_capture_amount * public.setting_num('platform_fee_rate', 0.2))::int;
  insert into public.earnings_ledger (woman_id, booking_id, payment_id, entry_type, gross, fee, net, is_sandbox)
    values (b.woman_id, b.id, pay.id, 'earning', p_capture_amount, fee, p_capture_amount - fee, pay.is_sandbox);
end $$;

create or replace function public.complete_booking(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); b public.bookings;
begin
  select * into b from public.bookings where id = p_id;
  if found and b.start_at > now() and not public.setting_bool('demo_mode') then
    perform public.raise_app('TOO_EARLY', '開始時刻前は完了にできません');
  end if;
  b := public.transition_booking(p_id, 'completed', '');
  perform public.settle_booking_payment(p_id, b.price);
  perform public.recompute_woman(b.woman_id, 'booking_completed');
  perform public.recompute_man(b.man_id, 'booking_completed');
  perform public.notify(b.man_id, 'booking', 'ご利用ありがとうございました', '予約が完了しました。実績に反映されています。', '/booking/' || b.id);
  perform public.notify(b.woman_id, 'earning', '報酬が確定しました（デモ）', '予約完了により報酬が台帳に記録されました。', '/w/earnings');
  return public.get_booking(p_id);
end $$;

create or replace function public.cancel_booking(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); b public.bookings; prev public.booking_status; pol jsonb := public.setting('cancellation_policy');
  late_fee int := 0; other uuid;
begin
  select status into prev from public.bookings where id = p_id;
  b := public.transition_booking(p_id, 'canceled', coalesce(p_reason, ''));
  update public.bookings set cancel_reason = left(coalesce(p_reason, ''), 200), canceled_by = uid where id = p_id;
  if prev = 'accepted' then
    if uid = b.man_id and b.start_at - now() < make_interval(hours => coalesce((pol ->> 'free_until_hours')::int, 24)) then
      late_fee := round(b.price * coalesce((pol ->> 'late_fee_rate')::numeric, 0))::int;
    end if;
    perform public.settle_booking_payment(p_id, late_fee);
    if b.slot_id is not null then update public.availability_slots set status = 'open' where id = b.slot_id and start_at > now(); end if;
    if late_fee > 0 then
      perform public.recompute_woman(b.woman_id, 'late_cancel_fee');
      perform public.recompute_man(b.man_id, 'late_cancel_fee');
    end if;
  end if;
  other := case when uid = b.man_id then b.woman_id else b.man_id end;
  perform public.notify(other, 'booking', '予約がキャンセルされました',
    to_char(b.start_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' の予約がキャンセルされました', '/booking/' || b.id);
  return public.get_booking(p_id);
end $$;

create or replace function public.open_dispute(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); b public.bookings;
begin
  select * into b from public.bookings where id = p_id;
  if found and b.status = 'completed' and b.completed_at < now() - make_interval(days => public.setting_num('dispute_window_days', 7)::int) then
    perform public.raise_app('TOO_LATE', '申立て期間を過ぎています。お問い合わせからご連絡ください');
  end if;
  b := public.transition_booking(p_id, 'disputed', coalesce(p_reason, ''));
  insert into public.reports (reporter_id, target_user_id, booking_id, category, detail)
    values (uid, case when uid = b.man_id then b.woman_id else b.man_id end, p_id, 'booking_dispute', left(coalesce(p_reason, ''), 1000));
  perform public.notify(case when uid = b.man_id then b.woman_id else b.man_id end, 'booking', '予約について申立てがありました',
    '運営が内容を確認します', '/booking/' || b.id);
  return public.get_booking(p_id);
end $$;

create or replace function public.request_refund(p_booking uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('man'); pay public.payments;
begin
  select p.* into pay from public.payments p join public.bookings b on b.id = p.booking_id
    where p.booking_id = p_booking and b.man_id = uid and p.status = 'captured';
  if not found then perform public.raise_app('NOT_FOUND', '返金対象の決済がありません'); end if;
  if exists (select 1 from public.refunds where payment_id = pay.id and status in ('requested', 'approved', 'processed')) then
    perform public.raise_app('DUPLICATE', '返金申請は受付済みです');
  end if;
  insert into public.refunds (payment_id, booking_id, amount, reason, requested_by) values (pay.id, p_booking, pay.amount, left(coalesce(p_reason, ''), 500), uid);
  return public.get_booking(p_booking);
end $$;

-- ---------------------------------------------------------------- bookings (both)
create or replace function public.get_booking(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.bookings; is_man boolean; adm boolean := public.is_admin();
begin
  select * into b from public.bookings where id = p_id;
  if not found or not (uid in (b.man_id, b.woman_id) or adm) then perform public.raise_app('NOT_FOUND', '予約が見つかりません'); end if;
  is_man := uid = b.man_id;
  return jsonb_build_object(
    'id', b.id, 'status', b.status, 'start_at', b.start_at, 'end_at', b.end_at, 'area', b.area, 'plan_type', b.plan_type,
    'price', b.price, 'message', b.man_message, 'decline_reason', b.decline_reason, 'cancel_reason', b.cancel_reason,
    'created_at', b.created_at, 'accepted_at', b.accepted_at, 'completed_at', b.completed_at,
    'my_side', case when is_man then 'man' when uid = b.woman_id then 'woman' else 'admin' end,
    'woman', public.woman_card(b.woman_id, null) - 'locked' - 'next_slot',
    'man', public.man_summary(b.man_id),
    'conversation_id', (select c.id from public.conversations c where c.man_id = b.man_id and c.woman_id = b.woman_id),
    'payment', (select jsonb_build_object('status', p.status, 'amount', case when is_man or adm then p.amount end, 'is_sandbox', p.is_sandbox)
                from public.payments p where p.booking_id = b.id and p.kind = 'booking'),
    'earning', case when not is_man then (select jsonb_build_object('gross', sum(gross), 'fee', sum(fee), 'net', sum(net))
                from public.earnings_ledger where booking_id = b.id) end,
    'refund', (select jsonb_build_object('status', r.status, 'amount', r.amount) from public.refunds r where r.booking_id = b.id
               order by r.created_at desc limit 1),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('to', to_status, 'from', from_status, 'at', created_at,
               'by', case when actor_id = b.man_id then 'man' when actor_id = b.woman_id then 'woman' else 'system' end) order by id), '[]')
               from public.booking_events where booking_id = b.id),
    'cancellation_policy', public.setting('cancellation_policy'));
end $$;

create or replace function public.list_my_bookings(p_scope text default 'all') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); r public.user_role := public.my_role();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'status', b.status, 'start_at', b.start_at, 'end_at', b.end_at,
    'area', b.area, 'plan_type', b.plan_type, 'price', b.price,
    'counterpart', case when r = 'man' then jsonb_build_object('id', b.woman_id, 'display_name', pw.display_name, 'photos', public.photo_paths(b.woman_id),
                    'rank_code', (select rank_code from public.women_profiles where user_id = b.woman_id))
                   else jsonb_build_object('id', b.man_id, 'display_name', pm.display_name, 'photos', public.photo_paths(b.man_id)) end)
    order by case when p_scope = 'past' then -extract(epoch from b.start_at) else extract(epoch from b.start_at) end), '[]')
    from public.bookings b join public.profiles pw on pw.id = b.woman_id join public.profiles pm on pm.id = b.man_id
    where (b.man_id = uid or b.woman_id = uid)
      and case p_scope
        when 'upcoming' then b.status = 'accepted'
        when 'pending' then b.status = 'requested'
        when 'past' then b.status in ('completed', 'declined', 'canceled', 'disputed')
        else true end);
end $$;

-- ---------------------------------------------------------------- women: dashboard & earnings
create or replace function public.woman_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); w public.women_profiles; nxt record; month_start timestamptz;
begin
  select * into w from public.women_profiles where user_id = uid;
  month_start := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  select code, min_value into nxt from public.rank_rules where audience = 'woman' and min_value > w.rank_score order by min_value limit 1;
  return jsonb_build_object(
    'pending_applications', (select count(*) from public.applications where woman_id = uid and status = 'pending'),
    'pending_bookings', (select count(*) from public.bookings where woman_id = uid and status = 'requested'),
    'month_net', (select coalesce(sum(net), 0) from public.earnings_ledger where woman_id = uid and created_at >= month_start
                  and entry_type in ('earning', 'reversal')),
    'total_net', public.woman_earnings_net(uid),
    'is_sandbox', public.setting('payment_mode') #>> '{}' = 'sandbox',
    'upcoming', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'start_at', b.start_at, 'end_at', b.end_at, 'area', b.area,
                 'plan_type', b.plan_type, 'man_name', p.display_name) order by b.start_at), '[]')
                 from public.bookings b join public.profiles p on p.id = b.man_id
                 where b.woman_id = uid and b.status = 'accepted'),
    'rank_code', w.rank_code, 'rank_score', w.rank_score,
    'next_rank', case when nxt.code is not null then jsonb_build_object('code', nxt.code, 'min_value', nxt.min_value) end,
    'rank_breakdown', (select breakdown - 'weights' from public.rank_snapshots where user_id = uid and audience = 'woman' order by computed_at desc limit 1),
    'level', w.level, 'xp', w.xp, 'level_floor_xp', public.xp_for_level(w.level), 'next_level_xp', public.xp_for_level(w.level + 1),
    'completed', public.completed_count(uid),
    'is_published', w.is_published, 'accept_mode', w.accept_mode, 'accept_requests', w.accept_requests,
    'badges', public.badges(uid));
end $$;

create or replace function public.get_earnings() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman');
begin
  return jsonb_build_object(
    'total_net', public.woman_earnings_net(uid),
    'total_gross', (select coalesce(sum(gross), 0) from public.earnings_ledger where woman_id = uid and entry_type in ('earning', 'reversal')),
    'total_fee', (select coalesce(sum(fee), 0) from public.earnings_ledger where woman_id = uid and entry_type in ('earning', 'reversal')),
    'fee_rate', public.setting('platform_fee_rate'),
    'is_sandbox', public.setting('payment_mode') #>> '{}' = 'sandbox',
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.entry_type, 'gross', e.gross, 'fee', e.fee, 'net', e.net,
                'is_sandbox', e.is_sandbox, 'created_at', e.created_at, 'booking_id', e.booking_id,
                'start_at', b.start_at, 'man_name', p.display_name) order by e.id desc), '[]')
                from public.earnings_ledger e left join public.bookings b on b.id = e.booking_id
                left join public.profiles p on p.id = b.man_id where e.woman_id = uid));
end $$;

create or replace function public.get_share_link(p_regenerate boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_role('woman'); l public.share_links;
begin
  if p_regenerate then update public.share_links set is_active = false where woman_id = uid and is_active; end if;
  select * into l from public.share_links where woman_id = uid and is_active;
  if not found then
    insert into public.share_links (woman_id, code) values (uid, encode(extensions.gen_random_bytes(9), 'hex')) returning * into l;
  end if;
  return jsonb_build_object('code', l.code, 'uses', l.uses, 'created_at', l.created_at);
end $$;

-- ---------------------------------------------------------------- chat
create or replace function public.list_conversations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  return (select coalesce(jsonb_agg(x.j order by x.sort_at desc nulls last), '[]') from (
    select coalesce(c.last_message_at, c.created_at) as sort_at, jsonb_build_object(
      'id', c.id, 'can_chat', public.can_chat(c.id, uid),
      'counterpart', jsonb_build_object('id', o.id, 'display_name', o.display_name, 'photos', public.photo_paths(o.id), 'role', o.role),
      'last_message', (select jsonb_build_object('body', m.body, 'created_at', m.created_at, 'mine', m.sender_id = uid)
                       from public.messages m where m.conversation_id = c.id order by m.id desc limit 1),
      'unread', (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> uid
                 and m.id > coalesce((select last_read_id from public.conversation_reads r where r.conversation_id = c.id and r.user_id = uid), 0))) as j
    from public.conversations c join public.profiles o on o.id = case when c.man_id = uid then c.woman_id else c.man_id end
    where uid in (c.man_id, c.woman_id) and not public.is_blocked_pair(c.man_id, c.woman_id)) x);
end $$;

create or replace function public.get_messages(p_conversation uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); c public.conversations; last_id bigint;
begin
  select * into c from public.conversations where id = p_conversation;
  if not found or uid not in (c.man_id, c.woman_id) or public.is_blocked_pair(c.man_id, c.woman_id) then
    perform public.raise_app('NOT_FOUND', 'メッセージが見つかりません');
  end if;
  select max(id) into last_id from public.messages where conversation_id = p_conversation;
  if last_id is not null then
    insert into public.conversation_reads (conversation_id, user_id, last_read_id) values (p_conversation, uid, last_id)
      on conflict (conversation_id, user_id) do update set last_read_id = greatest(public.conversation_reads.last_read_id, excluded.last_read_id);
  end if;
  return jsonb_build_object(
    'can_chat', public.can_chat(p_conversation, uid),
    'counterpart', (select jsonb_build_object('id', o.id, 'display_name', o.display_name, 'role', o.role, 'photos', public.photo_paths(o.id))
                    from public.profiles o where o.id = case when c.man_id = uid then c.woman_id else c.man_id end),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'created_at', m.created_at, 'mine', m.sender_id = uid)
                 order by m.id), '[]')
                 from (select * from public.messages where conversation_id = p_conversation and id > coalesce(p_after, 0)
                       order by id desc limit 200) m));
end $$;

create or replace function public.send_message(p_conversation uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); c public.conversations; v bigint; other uuid;
begin
  if not public.can_chat(p_conversation, uid) then
    perform public.raise_app('CHAT_FORBIDDEN', 'このお相手とはメッセージできません');
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then perform public.raise_app('INVALID', 'メッセージを入力してください'); end if;
  perform public.assert_clean_text(p_body);
  select * into c from public.conversations where id = p_conversation;
  insert into public.messages (conversation_id, sender_id, body) values (p_conversation, uid, left(trim(p_body), 2000)) returning id into v;
  update public.conversations set last_message_at = now() where id = p_conversation;
  other := case when c.man_id = uid then c.woman_id else c.man_id end;
  if not exists (select 1 from public.notifications where user_id = other and kind = 'message' and read_at is null
                 and link = '/chat/' || p_conversation) then
    perform public.notify(other, 'message', '新しいメッセージ', (select display_name from public.profiles where id = uid) || ' さんからメッセージが届きました',
      '/chat/' || p_conversation);
  end if;
  return jsonb_build_object('id', v);
end $$;

-- ---------------------------------------------------------------- safety
create or replace function public.block_user(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); b record;
begin
  if p_target = uid then perform public.raise_app('INVALID', '自分自身はブロックできません'); end if;
  insert into public.blocks (blocker_id, blocked_id) values (uid, p_target) on conflict do nothing;
  -- 進行中の申請は無効化（確定済み予約はキャンセル扱い）
  for b in select id, status, man_id, woman_id from public.bookings
           where ((man_id = uid and woman_id = p_target) or (woman_id = uid and man_id = p_target)) and status in ('requested', 'accepted') loop
    update public.bookings set status = 'canceled', cancel_reason = 'blocked', canceled_by = uid, updated_at = now() where id = b.id;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, note) values (b.id, b.status, 'canceled', uid, 'blocked');
    perform public.settle_booking_payment(b.id, 0);
  end loop;
  update public.applications set status = 'withdrawn' where ((man_id = uid and woman_id = p_target) or (woman_id = uid and man_id = p_target))
    and status = 'pending';
  perform public.audit('user.block', 'user', p_target::text, '{}');
  return jsonb_build_object('blocked', true);
end $$;

create or replace function public.unblock_user(p_target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  delete from public.blocks where blocker_id = uid and blocked_id = p_target;
  return jsonb_build_object('blocked', false);
end $$;

create or replace function public.list_blocks() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'created_at', b.created_at) order by b.created_at desc), '[]')
  from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = auth.uid()
$$;

create or replace function public.report_user(p_target uuid, p_category text, p_detail text, p_booking uuid default null,
  p_message bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); v uuid;
begin
  if p_target = uid then perform public.raise_app('INVALID', '自分自身は通報できません'); end if;
  if p_category not in ('prohibited_service', 'harassment', 'solicitation', 'fake_profile', 'underage', 'safety', 'no_show', 'other') then
    perform public.raise_app('INVALID', '通報カテゴリが不正です');
  end if;
  if p_message is not null and not exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
      where m.id = p_message and uid in (c.man_id, c.woman_id)) then
    perform public.raise_app('INVALID', '対象メッセージが見つかりません');
  end if;
  insert into public.reports (reporter_id, target_user_id, booking_id, message_id, category, detail)
    values (uid, p_target, p_booking, p_message, p_category, left(coalesce(p_detail, ''), 2000)) returning id into v;
  perform public.audit('report.create', 'user', p_target::text, jsonb_build_object('report', v, 'category', p_category));
  return jsonb_build_object('id', v);
end $$;

create or replace function public.submit_inquiry(p_category text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v uuid;
begin
  if uid is null then perform public.raise_app('AUTH_REQUIRED', 'ログインが必要です'); end if;
  if char_length(trim(coalesce(p_body, ''))) < 5 then perform public.raise_app('INVALID', '内容を5文字以上で入力してください'); end if;
  insert into public.inquiries (user_id, category, body) values (uid, p_category, left(p_body, 3000)) returning id into v;
  return jsonb_build_object('id', v);
end $$;

create or replace function public.list_my_inquiries() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'body', body, 'status', status,
    'admin_reply', admin_reply, 'created_at', created_at) order by created_at desc), '[]')
  from public.inquiries where user_id = auth.uid()
$$;

-- 退会申請: 即時に非公開化・進行中予約をキャンセルし、運営が匿名化処理を行う（会計記録は法定期間保持）
create or replace function public.request_account_deletion(p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); b record;
begin
  for b in select id, status from public.bookings where (man_id = uid or woman_id = uid) and status in ('requested', 'accepted') loop
    update public.bookings set status = 'canceled', cancel_reason = 'account_deletion', canceled_by = uid, updated_at = now() where id = b.id;
    insert into public.booking_events (booking_id, from_status, to_status, actor_id, note) values (b.id, b.status, 'canceled', uid, 'account_deletion');
    perform public.settle_booking_payment(b.id, 0);
  end loop;
  update public.women_profiles set is_published = false where user_id = uid;
  update public.membership_entitlements set cancel_at_period_end = true where user_id = uid and status = 'active';
  update public.share_links set is_active = false where woman_id = uid;
  insert into public.inquiries (user_id, category, body) values (uid, 'deletion', coalesce(nullif(trim(p_reason), ''), '（理由未記入）'));
  update public.profiles set status = 'deletion_requested', status_reason = 'user_request', updated_at = now() where id = uid;
  perform public.audit('user.deletion_requested', 'user', uid::text, '{}');
  return jsonb_build_object('status', 'deletion_requested');
end $$;
