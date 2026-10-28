-- 共通ヘルパー、サインアップ時のプロフィール作成、ランク・レベル計算（サーバー確定）

-- ---------------------------------------------------------------- default settings (仮設定)
insert into public.app_settings (key, value, description, is_public) values
  ('service_name', '"PROJECT GOLD"', 'サービス名（仮称）', true),
  ('payment_mode', '"sandbox"', 'sandbox=疑似決済のみ / live=承認済み決済事業者（未設定のため起動不可）', true),
  ('platform_fee_rate', '0.2', '予約金額に対するプラットフォーム手数料率（仮）', false),
  ('min_age', '20', '登録可能な最低年齢（法令確認待ちの仮設定）', true),
  ('demo_auto_verify', 'false', 'true の場合デモ本人確認を即時承認（開発環境専用）', false),
  ('photo_auto_approve', 'true', 'true の場合アップロード写真を即時公開（false で運営審査）', false),
  ('demo_mode', 'true', 'デモ環境フラグ。予約開始前の完了操作などテスト用の緩和を許可', true),
  ('count_subscription_toward_spend', 'false', 'サブスク支払を累計利用額に含めるか', false),
  ('cancellation_policy', '{"free_until_hours": 24, "late_fee_rate": 0, "note": "仮設定：本番前に確定"}', 'キャンセル規定（仮）', true),
  ('dispute_window_days', '7', '完了後に申立てできる日数', true),
  ('woman_rank_weights', '{"profile":15,"review":35,"venue":10,"earnings":20,"earnings_cap":300000,"record":20,"record_cap":20,"report_penalty":10}', '女性ランクスコアの配点（監査可能）', false),
  ('prohibited_terms', '["本番","円光","エンコー","援交","援助交際","大人の関係","大人あり","ホ別","性行為","セックス","裏オプ","風俗求人","高収入求人","スカウト報酬","パパ活"]', '投稿禁止語（性的サービス・求人勧誘の防止）', false),
  ('price_display_note', '"表示価格はすべてデモ用の仮設定です"', '料金表示の注記', true)
on conflict (key) do nothing;

insert into public.rank_rules (audience, code, label, min_value, sort) values
  ('woman', 'C', 'C', 0, 1), ('woman', 'B', 'B', 40, 2), ('woman', 'A', 'A', 60, 3), ('woman', 'S', 'S', 80, 4),
  ('man_spend', 'C', 'C', 0, 1), ('man_spend', 'B', 'B', 50000, 2), ('man_spend', 'A', 'A', 200000, 3), ('man_spend', 'S', 'S', 500000, 4)
on conflict do nothing;

insert into public.membership_plans (code, name, monthly_price, unlock_rank, perks, sort) values
  ('FREE', 'FREE', 0, 'C', '["Cランクの女性へ申し込み","チャット・予約管理"]', 1),
  ('SILVER', 'SILVER', 4980, 'B', '["Bランクまで申し込み可能","検索条件の保存"]', 2),
  ('GOLD', 'GOLD', 14800, 'A', '["Aランクまで申し込み可能","優先サポート"]', 3),
  ('BLACK', 'BLACK', 29800, 'S', '["全ランクへ申し込み可能","専任コンシェルジュ（予定）"]', 4)
on conflict do nothing;

-- ---------------------------------------------------------------- tiny helpers
create or replace function public.setting(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = p_key
$$;

create or replace function public.setting_num(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = p_key), p_default)
$$;

create or replace function public.setting_bool(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_settings where key = p_key), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active')
$$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.rank_sort(p_audience text, p_code text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sort from public.rank_rules where audience = p_audience and code = p_code), 0)
$$;

create or replace function public.rank_for_value(p_audience text, p_value numeric) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select code from public.rank_rules where audience = p_audience and min_value <= p_value order by sort desc limit 1),
    (select code from public.rank_rules where audience = p_audience order by sort asc limit 1))
$$;

create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.level_for_xp(p_xp int) returns int
language sql immutable as $$ select floor(sqrt(greatest(p_xp, 0) / 100.0))::int + 1 $$;

create or replace function public.xp_for_level(p_level int) returns int
language sql immutable as $$ select (100 * (p_level - 1) * (p_level - 1))::int $$;

create or replace function public.raise_app(p_code text, p_message text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end $$;

create or replace function public.require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid(); s public.account_status;
begin
  if v is null then perform public.raise_app('AUTH_REQUIRED', 'ログインが必要です'); end if;
  select status into s from public.profiles where id = v;
  if s is null then perform public.raise_app('AUTH_REQUIRED', 'プロフィールが見つかりません'); end if;
  if s <> 'active' then perform public.raise_app('ACCOUNT_INACTIVE', 'このアカウントは現在利用できません'); end if;
  return v;
end $$;

create or replace function public.require_role(p_role public.user_role) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := public.require_user();
begin
  if (select role from public.profiles where id = v) <> p_role then
    perform public.raise_app('FORBIDDEN', 'この操作は許可されていません');
  end if;
  return v;
end $$;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then perform public.raise_app('FORBIDDEN', '管理者権限が必要です'); end if;
  return auth.uid();
end $$;

create or replace function public.audit(p_action text, p_target_type text, p_target_id text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_detail, '{}'))
$$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

-- 性的サービスの売買・求人勧誘につながる文言をサーバー側で拒否する
create or replace function public.assert_clean_text(p_text text) returns void
language plpgsql stable security definer set search_path = public as $$
declare term text; t text := lower(coalesce(p_text, ''));
begin
  for term in select jsonb_array_elements_text(coalesce(public.setting('prohibited_terms'), '[]')) loop
    if position(lower(term) in t) > 0 then
      perform public.raise_app('MODERATION_BLOCKED',
        '利用規約で禁止されている内容が含まれているため送信できません（性的サービスの売買・求人勧誘などは禁止されています）');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- signup hook
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', '');
  v_name text := left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)), 30);
begin
  -- 管理者ロールはクライアントから指定不可（運営が SQL で付与する）
  if v_role not in ('woman', 'man') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  insert into public.profiles (id, role, display_name) values (new.id, v_role::public.user_role, v_name);
  if v_role = 'woman' then
    insert into public.women_profiles (user_id) values (new.id);
  else
    insert into public.men_profiles (user_id) values (new.id);
  end if;
  insert into public.verification_states (user_id) values (new.id);
  insert into public.notifications (user_id, kind, title, body, link) values
    (new.id, 'system', 'ようこそ', '本人確認（20歳以上）を完了すると、申し込み・予約機能を利用できます。', '/verification');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- stats & ranks (server authoritative)
create or replace function public.woman_earnings_net(p_woman uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(net), 0)::int from public.earnings_ledger
  where woman_id = p_woman and entry_type in ('earning', 'reversal')
    and is_sandbox = (public.setting('payment_mode') #>> '{}' = 'sandbox')
$$;

create or replace function public.man_spend_total(p_man uuid) returns int
language sql stable security definer set search_path = public as $$
  with mode as (select (public.setting('payment_mode') #>> '{}' = 'sandbox') as sb)
  select (
    coalesce((select sum(p.amount) from public.payments p, mode
      where p.user_id = p_man and p.is_sandbox = mode.sb and p.status in ('captured', 'refunded')
        and (p.kind in ('booking', 'adjustment')
             or (p.kind = 'subscription' and public.setting_bool('count_subscription_toward_spend')))), 0)
    - coalesce((select sum(r.amount) from public.refunds r join public.payments p on p.id = r.payment_id, mode
      where p.user_id = p_man and p.is_sandbox = mode.sb and r.status = 'processed'
        and (p.kind in ('booking', 'adjustment')
             or (p.kind = 'subscription' and public.setting_bool('count_subscription_toward_spend')))), 0)
  )::int
$$;

create or replace function public.completed_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.bookings where (man_id = p_user or woman_id = p_user) and status = 'completed'
$$;

create or replace function public.actioned_reports(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.reports where target_user_id = p_user and status = 'actioned'
$$;

create or replace function public.recompute_woman(p_woman uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  w public.women_profiles; wt jsonb := public.setting('woman_rank_weights');
  n_photos int; venue_ok boolean; net int; done int; bad int; verified boolean;
  s_profile numeric; s_review numeric; s_venue numeric; s_earn numeric; s_record numeric; s_pen numeric; total numeric;
  v_rank text; v_xp int;
begin
  select * into w from public.women_profiles where user_id = p_woman;
  if not found then return; end if;
  select count(*) into n_photos from public.profile_photos where user_id = p_woman and status = 'approved';
  select exists (select 1 from public.venue_references where woman_id = p_woman and verify_status = 'approved') into venue_ok;
  net := public.woman_earnings_net(p_woman);
  done := public.completed_count(p_woman);
  bad := public.actioned_reports(p_woman);
  select status = 'approved' into verified from public.verification_states where user_id = p_woman;

  s_profile := round((case when char_length(w.bio) >= 30 then 0.35 else 0 end
             + case when n_photos >= 3 then 0.35 when n_photos >= 1 then 0.15 else 0 end
             + case when cardinality(w.areas) > 0 then 0.2 else 0 end
             + case when char_length(w.headline) > 0 then 0.1 else 0 end) * (wt ->> 'profile')::numeric, 2);
  s_review := round(w.review_score / 100.0 * (wt ->> 'review')::numeric, 2);
  s_venue := case when venue_ok then (wt ->> 'venue')::numeric else 0 end;
  s_earn := round(least(net::numeric / greatest((wt ->> 'earnings_cap')::numeric, 1), 1) * (wt ->> 'earnings')::numeric, 2);
  s_record := round(least(done::numeric / greatest((wt ->> 'record_cap')::numeric, 1), 1) * (wt ->> 'record')::numeric, 2);
  s_pen := bad * (wt ->> 'report_penalty')::numeric;
  total := greatest(s_profile + s_review + s_venue + s_earn + s_record - s_pen, 0);
  v_rank := public.rank_for_value('woman', total);

  v_xp := (case when verified then 200 else 0 end) + done * 100 + (case when n_photos >= 3 then 100 else 0 end)
          + least(net / 1000, 3000);
  v_xp := greatest(v_xp - bad * 200, 0);

  update public.women_profiles set rank_code = v_rank, rank_score = total, xp = v_xp,
    level = public.level_for_xp(v_xp), updated_at = now() where user_id = p_woman;

  if w.rank_code is distinct from v_rank or w.rank_score is distinct from total then
    insert into public.rank_snapshots (user_id, audience, rank_code, score, breakdown, reason)
    values (p_woman, 'woman', v_rank, total, jsonb_build_object(
      'profile', s_profile, 'review', s_review, 'venue', s_venue, 'earnings', s_earn, 'record', s_record,
      'penalty', s_pen, 'inputs', jsonb_build_object('photos', n_photos, 'venue_verified', venue_ok,
      'net_earnings', net, 'completed', done, 'actioned_reports', bad), 'weights', wt), p_reason);
  end if;
end $$;

create or replace function public.recompute_man(p_man uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
declare m public.men_profiles; spend int; done int; bad int; verified boolean; v_rank text; v_xp int;
begin
  select * into m from public.men_profiles where user_id = p_man;
  if not found then return; end if;
  spend := public.man_spend_total(p_man);
  done := public.completed_count(p_man);
  bad := public.actioned_reports(p_man);
  select status = 'approved' into verified from public.verification_states where user_id = p_man;
  v_rank := public.rank_for_value('man_spend', spend);
  v_xp := (case when verified then 200 else 0 end) + done * 100 + least(spend / 1000, 3000)
          + (case when char_length(m.bio) >= 20 then 50 else 0 end);
  v_xp := greatest(v_xp - bad * 200, 0);
  update public.men_profiles set spend_total = spend, spend_rank_code = v_rank, xp = v_xp,
    level = public.level_for_xp(v_xp), updated_at = now() where user_id = p_man;
  if m.spend_rank_code is distinct from v_rank or m.spend_total is distinct from spend then
    insert into public.rank_snapshots (user_id, audience, rank_code, score, breakdown, reason)
    values (p_man, 'man_spend', v_rank, spend, jsonb_build_object('spend_total', spend, 'completed', done,
      'actioned_reports', bad, 'verified', verified), p_reason);
  end if;
end $$;

create or replace function public.recompute_user(p_user uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = p_user) = 'woman' then
    perform public.recompute_woman(p_user, p_reason);
  else
    perform public.recompute_man(p_user, p_reason);
  end if;
end $$;

-- 男性の申し込み可能ランク = max(累計確定利用額のランク, 有効な月額プランの解放ランク)
create or replace function public.man_access(p_man uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare spend_rank text; plan_rank text; plan_code text; v_unlock text; verified boolean;
begin
  select spend_rank_code into spend_rank from public.men_profiles where user_id = p_man;
  select e.plan_code, p.unlock_rank into plan_code, plan_rank
    from public.membership_entitlements e join public.membership_plans p on p.code = e.plan_code
    where e.user_id = p_man and e.status = 'active' and e.current_period_end > now() limit 1;
  if plan_code is null then
    select code, unlock_rank into plan_code, plan_rank from public.membership_plans where code = 'FREE';
  end if;
  v_unlock := case when public.rank_sort('woman', coalesce(plan_rank, 'C')) >= public.rank_sort('woman', coalesce(spend_rank, 'C'))
                   then coalesce(plan_rank, 'C') else spend_rank end;
  select status = 'approved' into verified from public.verification_states where user_id = p_man;
  return jsonb_build_object('spend_rank', spend_rank, 'plan_code', plan_code, 'plan_rank', plan_rank,
    'unlocked_rank', v_unlock, 'unlocked_sort', public.rank_sort('woman', v_unlock), 'verified', coalesce(verified, false),
    'source', case when public.rank_sort('woman', coalesce(plan_rank,'C')) >= public.rank_sort('woman', coalesce(spend_rank,'C'))
                   then 'plan' else 'spend' end);
end $$;

-- 男性→女性への申し込み可否と理由（UI のロック表示もこれを使う）
create or replace function public.eligibility(p_man uuid, p_woman uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  acc jsonb := public.man_access(p_man); w public.women_profiles; wp public.profiles; mp public.men_profiles;
  reasons jsonb := '[]'; app public.applications; rank_locked boolean := false; invited boolean; can_apply boolean;
  w_verified boolean;
begin
  select * into w from public.women_profiles where user_id = p_woman;
  select * into wp from public.profiles where id = p_woman;
  select * into mp from public.men_profiles where user_id = p_man;
  select * into app from public.applications where man_id = p_man and woman_id = p_woman;
  select status = 'approved' into w_verified from public.verification_states where user_id = p_woman;
  invited := app.status = 'approved' and app.source = 'invite';

  if wp.id is null or wp.status <> 'active' or not w.is_published or not coalesce(w_verified, false) then
    reasons := reasons || jsonb_build_object('code', 'UNAVAILABLE', 'message', '現在このプロフィールは受付していません');
  end if;
  if public.is_blocked_pair(p_man, p_woman) then
    reasons := reasons || jsonb_build_object('code', 'BLOCKED', 'message', '申し込みできません');
  end if;
  if not (acc ->> 'verified')::boolean then
    reasons := reasons || jsonb_build_object('code', 'VERIFY_REQUIRED', 'message', '本人確認（20歳以上）の完了が必要です');
  end if;
  if public.rank_sort('woman', w.rank_code) > (acc ->> 'unlocked_sort')::int and not coalesce(invited, false) then
    rank_locked := true;
    reasons := reasons || jsonb_build_object('code', 'RANK_LOCKED', 'message',
      format('%sランクの女性への申し込みには、%sランクの解放が必要です', w.rank_code, w.rank_code));
  end if;
  if coalesce(mp.level, 1) < w.min_man_level and not coalesce(invited, false) then
    reasons := reasons || jsonb_build_object('code', 'LEVEL_REQUIRED', 'message',
      format('この方への申し込みには Lv.%s 以上が必要です', w.min_man_level));
  end if;
  if not w.accept_requests then
    reasons := reasons || jsonb_build_object('code', 'PAUSED', 'message', '現在新規の申し込みを停止しています');
  end if;
  can_apply := jsonb_array_length(reasons) = 0;
  if w.accept_mode = 'select' and coalesce(app.status::text, '') <> 'approved' then
    reasons := reasons || jsonb_build_object('code', 'APPROVAL_REQUIRED', 'message',
      'この方は「自分で選ぶ」モードです。まずプロフィールへの申請を送り、承認されると予約申請ができます');
  end if;
  return jsonb_build_object(
    'can_request', jsonb_array_length(reasons) = 0,
    'can_apply', can_apply and w.accept_mode = 'select' and app.id is null,
    'rank_locked', rank_locked,
    'application_status', app.status,
    'application_source', app.source,
    'reasons', reasons,
    'access', acc);
end $$;
