-- 運営者向け RPC。すべて require_admin() で検証し、変更系は audit_events に記録する。

create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare decided int; ok int;
begin
  perform public.require_admin();
  select count(*) filter (where status in ('accepted', 'completed', 'declined', 'canceled', 'disputed')),
         count(*) filter (where status in ('accepted', 'completed'))
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
    'applications', (select count(*) from public.applications),
    'bookings', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.bookings group by status) s),
    'booking_total', (select count(*) from public.bookings),
    'success_rate', case when decided > 0 then round(ok::numeric / decided * 100, 1) else null end,
    'revenue', (select jsonb_build_object(
       'subscription', coalesce(sum(amount) filter (where kind = 'subscription' and status = 'captured'), 0),
       'booking_gross', coalesce(sum(amount) filter (where kind = 'booking' and status in ('captured', 'refunded')), 0))
       from public.payments where is_sandbox = (public.setting('payment_mode') #>> '{}' = 'sandbox')),
    'platform_fee', (select coalesce(sum(fee), 0) from public.earnings_ledger where is_sandbox = (public.setting('payment_mode') #>> '{}' = 'sandbox')),
    'reports_open', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'disputes_open', (select count(*) from public.bookings where status = 'disputed'),
    'refunds_open', (select count(*) from public.refunds where status = 'requested'),
    'inquiries_open', (select count(*) from public.inquiries where status = 'open'),
    'payment_mode', public.setting('payment_mode'));
end $$;

create or replace function public.admin_list_users(p_role text default null, p_status text default null,
  p_verification text default null, p_query text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'role', p.role, 'display_name', p.display_name, 'area', p.area,
    'status', p.status, 'created_at', p.created_at, 'email', u.email, 'verification', v.status,
    'rank', coalesce(w.rank_code, m.spend_rank_code), 'level', coalesce(w.level, m.level), 'is_published', w.is_published)
    order by p.created_at desc), '[]')
    from public.profiles p join auth.users u on u.id = p.id
    left join public.verification_states v on v.user_id = p.id
    left join public.women_profiles w on w.user_id = p.id left join public.men_profiles m on m.user_id = p.id
    where (p_role is null or p_role = '' or p.role::text = p_role)
      and (p_status is null or p_status = '' or p.status::text = p_status)
      and (p_verification is null or p_verification = '' or v.status::text = p_verification)
      and (p_query is null or p_query = '' or p.display_name ilike '%' || p_query || '%' or u.email ilike '%' || p_query || '%')
    limit 300);
end $$;

create or replace function public.admin_get_user(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  perform public.require_admin();
  select * into p from public.profiles where id = p_id;
  if not found then perform public.raise_app('NOT_FOUND', 'ユーザーが見つかりません'); end if;
  return jsonb_build_object(
    'profile', to_jsonb(p), 'email', (select email from auth.users where id = p_id),
    'verification', (select to_jsonb(v) from public.verification_states v where v.user_id = p_id),
    'woman', (select to_jsonb(w) from public.women_profiles w where w.user_id = p_id),
    'man', (select to_jsonb(m) from public.men_profiles m where m.user_id = p_id),
    'access', case when p.role = 'man' then public.man_access(p_id) end,
    'venue', (select to_jsonb(x) from public.venue_references x where x.woman_id = p_id),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', storage_path, 'status', status) order by sort_order), '[]')
               from public.profile_photos where user_id = p_id),
    'rank_snapshots', (select coalesce(jsonb_agg(to_jsonb(s) order by s.computed_at desc), '[]')
                       from (select * from public.rank_snapshots where user_id = p_id order by computed_at desc limit 20) s),
    'reports_against', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'status', status, 'created_at', created_at)), '[]')
                        from public.reports where target_user_id = p_id),
    'bookings', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.bookings
                 where man_id = p_id or woman_id = p_id group by status) s),
    'earnings_net', case when p.role = 'woman' then public.woman_earnings_net(p_id) end,
    'entitlement', (select to_jsonb(e) from public.membership_entitlements e where e.user_id = p_id and e.status = 'active'));
end $$;

create or replace function public.admin_set_verification(p_user uuid, p_status public.verification_status, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm uuid := public.require_admin();
begin
  update public.verification_states set status = p_status, reviewed_at = now(), reviewed_by = adm,
    rejection_reason = case when p_status = 'rejected' then coalesce(p_reason, '書類を確認できませんでした') end where user_id = p_user;
  if not found then perform public.raise_app('NOT_FOUND', 'ユーザーが見つかりません'); end if;
  if p_status <> 'approved' then update public.women_profiles set is_published = false where user_id = p_user; end if;
  perform public.audit('admin.verification', 'user', p_user::text, jsonb_build_object('status', p_status, 'reason', p_reason));
  perform public.notify(p_user, 'verification', case when p_status = 'approved' then '本人確認が完了しました' else '本人確認の結果のお知らせ' end,
    case when p_status = 'approved' then '申し込み・予約機能をご利用いただけます' else coalesce(p_reason, '内容をご確認ください') end, '/verification');
  perform public.recompute_user(p_user, 'verification_reviewed');
  return public.admin_get_user(p_user);
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm uuid := public.require_admin();
begin
  if p_user = adm then perform public.raise_app('INVALID', '自分自身の状態は変更できません'); end if;
  if p_status = 'deleted' then perform public.raise_app('INVALID', '削除は退会処理から実行してください'); end if;
  update public.profiles set status = p_status, status_reason = p_reason, updated_at = now() where id = p_user;
  if p_status = 'suspended' then
    update public.women_profiles set is_published = false where user_id = p_user;
    perform public.notify(p_user, 'system', 'アカウントが一時停止されました', coalesce(p_reason, '') || '（異議申立ては問い合わせから可能です）', '/support');
  end if;
  perform public.audit('admin.user_status', 'user', p_user::text, jsonb_build_object('status', p_status, 'reason', p_reason));
  return public.admin_get_user(p_user);
end $$;

create or replace function public.admin_set_review(p_woman uuid, p_score int, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.women_profiles set review_score = greatest(0, least(p_score, 100)), review_note = coalesce(p_note, '') where user_id = p_woman;
  if not found then perform public.raise_app('NOT_FOUND', '女性プロフィールが見つかりません'); end if;
  perform public.audit('admin.review_score', 'user', p_woman::text, jsonb_build_object('score', p_score));
  perform public.recompute_woman(p_woman, 'admin_review');
  return public.admin_get_user(p_woman);
end $$;

create or replace function public.admin_set_venue_status(p_venue uuid, p_status public.verification_status) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm uuid := public.require_admin(); w uuid;
begin
  update public.venue_references set verify_status = p_status, verified_by = adm, verified_at = now() where id = p_venue returning woman_id into w;
  if w is null then perform public.raise_app('NOT_FOUND', '店舗情報が見つかりません'); end if;
  perform public.audit('admin.venue', 'venue', p_venue::text, jsonb_build_object('status', p_status));
  perform public.recompute_woman(w, 'venue_reviewed');
  return public.admin_get_user(w);
end $$;

create or replace function public.admin_review_queue() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object('user_id', v.user_id, 'display_name', p.display_name, 'role', p.role,
                      'birth_year', v.birth_year, 'method', v.method, 'submitted_at', v.submitted_at) order by v.submitted_at), '[]')
                      from public.verification_states v join public.profiles p on p.id = v.user_id where v.status = 'pending'),
    'venues', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'woman_id', x.woman_id, 'display_name', p.display_name,
               'venue_name', x.venue_name, 'area', x.area, 'is_public', x.is_public, 'created_at', x.created_at)), '[]')
               from public.venue_references x join public.profiles p on p.id = x.woman_id where x.verify_status = 'pending'),
    'photos', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'user_id', f.user_id, 'display_name', p.display_name,
               'path', f.storage_path, 'created_at', f.created_at)), '[]')
               from public.profile_photos f join public.profiles p on p.id = f.user_id where f.status = 'pending'),
    'deletions', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'display_name', p.display_name, 'role', p.role,
                  'updated_at', p.updated_at)), '[]') from public.profiles p where p.status = 'deletion_requested'));
end $$;

create or replace function public.admin_moderate_photo(p_photo uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  perform public.require_admin();
  if p_status not in ('approved', 'rejected') then perform public.raise_app('INVALID', '不正なステータスです'); end if;
  update public.profile_photos set status = p_status where id = p_photo returning user_id into u;
  if u is null then perform public.raise_app('NOT_FOUND', '写真が見つかりません'); end if;
  perform public.audit('admin.photo', 'photo', p_photo::text, jsonb_build_object('status', p_status));
  perform public.recompute_user(u, 'photo_reviewed');
  return public.admin_review_queue();
end $$;

-- ---------------------------------------------------------------- settings, plans, ranks
create or replace function public.admin_list_settings() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'settings', (select jsonb_agg(to_jsonb(s) order by key) from public.app_settings s),
    'plans', (select jsonb_agg(to_jsonb(p) order by sort) from public.membership_plans p),
    'rank_rules', (select jsonb_agg(to_jsonb(r) order by audience, sort) from public.rank_rules r));
end $$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare adm uuid := public.require_admin(); old jsonb;
begin
  select value into old from public.app_settings where key = p_key;
  if not found then perform public.raise_app('NOT_FOUND', '設定キーが見つかりません'); end if;
  if p_key = 'payment_mode' and p_value #>> '{}' not in ('sandbox', 'live') then
    perform public.raise_app('INVALID', 'payment_mode は sandbox / live のみ指定できます');
  end if;
  update public.app_settings set value = p_value, updated_at = now(), updated_by = adm where key = p_key;
  perform public.audit('admin.setting', 'setting', p_key, jsonb_build_object('old', old, 'new', p_value));
  return public.admin_list_settings();
end $$;

create or replace function public.admin_upsert_plan(p_code text, p_name text, p_price int, p_unlock_rank text, p_perks jsonb,
  p_is_active boolean, p_sort int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.rank_rules where audience = 'woman' and code = p_unlock_rank) then
    perform public.raise_app('INVALID', '解放ランクが不正です');
  end if;
  insert into public.membership_plans (code, name, monthly_price, unlock_rank, perks, is_active, sort)
    values (upper(p_code), p_name, p_price, p_unlock_rank, coalesce(p_perks, '[]'), coalesce(p_is_active, true), coalesce(p_sort, 0))
    on conflict (code) do update set name = excluded.name, monthly_price = excluded.monthly_price, unlock_rank = excluded.unlock_rank,
      perks = excluded.perks, is_active = excluded.is_active, sort = excluded.sort, updated_at = now();
  perform public.audit('admin.plan', 'plan', upper(p_code), jsonb_build_object('price', p_price, 'unlock', p_unlock_rank, 'active', p_is_active));
  return public.admin_list_settings();
end $$;

create or replace function public.admin_upsert_rank_rule(p_audience text, p_code text, p_label text, p_min numeric, p_sort int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  perform public.require_admin();
  insert into public.rank_rules (audience, code, label, min_value, sort) values (p_audience, p_code, p_label, p_min, p_sort)
    on conflict (audience, code) do update set label = excluded.label, min_value = excluded.min_value, sort = excluded.sort;
  perform public.audit('admin.rank_rule', 'rank_rule', p_audience || ':' || p_code, jsonb_build_object('min', p_min, 'sort', p_sort));
  for u in select id from public.profiles where role = case when p_audience = 'woman' then 'woman'::public.user_role else 'man' end loop
    perform public.recompute_user(u.id, 'rank_rule_changed');
  end loop;
  return public.admin_list_settings();
end $$;

-- ---------------------------------------------------------------- bookings / disputes / refunds
create or replace function public.admin_list_bookings(p_status text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'status', b.status, 'start_at', b.start_at, 'end_at', b.end_at,
    'price', b.price, 'area', b.area, 'man_name', pm.display_name, 'woman_name', pw.display_name, 'man_id', b.man_id, 'woman_id', b.woman_id,
    'payment_status', (select status from public.payments where booking_id = b.id and kind = 'booking'),
    'refund_status', (select status from public.refunds where booking_id = b.id order by created_at desc limit 1),
    'created_at', b.created_at) order by b.created_at desc), '[]')
    from (select * from public.bookings where p_status is null or p_status = '' or status::text = p_status order by created_at desc limit 300) b
    join public.profiles pm on pm.id = b.man_id join public.profiles pw on pw.id = b.woman_id);
end $$;

create or replace function public.process_refund(p_refund uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.refunds; pay public.payments; earned record;
begin
  select * into r from public.refunds where id = p_refund for update;
  select * into pay from public.payments where id = r.payment_id for update;
  update public.refunds set status = 'processed', decided_by = auth.uid(), decided_at = now() where id = r.id;
  update public.payments set status = 'refunded', updated_at = now() where id = pay.id;
  select sum(gross) g, sum(fee) f, sum(net) n into earned from public.earnings_ledger where payment_id = pay.id;
  if pay.kind = 'booking' and coalesce(earned.g, 0) > 0 then
    insert into public.earnings_ledger (woman_id, booking_id, payment_id, entry_type, gross, fee, net, is_sandbox)
      select b.woman_id, b.id, pay.id, 'reversal', -earned.g, -earned.f, -earned.n, pay.is_sandbox from public.bookings b where b.id = pay.booking_id;
    perform public.recompute_woman((select woman_id from public.bookings where id = pay.booking_id), 'refund');
  end if;
  perform public.recompute_man(pay.user_id, 'refund');
  perform public.notify(pay.user_id, 'payment', '返金が処理されました（デモ）', format('%s円の返金を記録しました', r.amount), null);
end $$;

create or replace function public.admin_resolve_dispute(p_booking uuid, p_outcome text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bookings; pay public.payments; rid uuid;
begin
  perform public.require_admin();
  select * into b from public.bookings where id = p_booking;
  if not found or b.status <> 'disputed' then perform public.raise_app('INVALID', '申立て中の予約ではありません'); end if;
  select * into pay from public.payments where booking_id = p_booking and kind = 'booking';
  if p_outcome = 'complete' then
    perform public.transition_booking(p_booking, 'completed', coalesce(p_note, ''));
    perform public.settle_booking_payment(p_booking, b.price);
  elsif p_outcome = 'cancel' then
    perform public.transition_booking(p_booking, 'canceled', coalesce(p_note, ''));
    perform public.settle_booking_payment(p_booking, 0);
  elsif p_outcome = 'refund' then
    perform public.transition_booking(p_booking, 'canceled', coalesce(p_note, ''));
    if pay.status = 'captured' then
      insert into public.refunds (payment_id, booking_id, amount, reason, status, requested_by)
        values (pay.id, p_booking, pay.amount, coalesce(p_note, '申立てによる返金'), 'approved', auth.uid()) returning id into rid;
      perform public.process_refund(rid);
    else
      perform public.settle_booking_payment(p_booking, 0);
    end if;
  else
    perform public.raise_app('INVALID', '不正な処理区分です');
  end if;
  update public.reports set status = 'actioned', admin_note = coalesce(p_note, ''), resolved_by = auth.uid(), resolved_at = now()
    where booking_id = p_booking and category = 'booking_dispute' and status in ('open', 'reviewing');
  perform public.recompute_woman(b.woman_id, 'dispute_resolved');
  perform public.recompute_man(b.man_id, 'dispute_resolved');
  perform public.audit('admin.dispute', 'booking', p_booking::text, jsonb_build_object('outcome', p_outcome, 'note', p_note));
  perform public.notify(b.man_id, 'booking', '申立ての結果', '運営が予約の申立てを処理しました', '/booking/' || b.id);
  perform public.notify(b.woman_id, 'booking', '申立ての結果', '運営が予約の申立てを処理しました', '/booking/' || b.id);
  return public.get_booking(p_booking);
end $$;

create or replace function public.admin_list_refunds(p_status text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'amount', r.amount, 'reason', r.reason, 'status', r.status,
    'booking_id', r.booking_id, 'requested_by', p.display_name, 'created_at', r.created_at) order by r.created_at desc), '[]')
    from public.refunds r left join public.profiles p on p.id = r.requested_by
    where p_status is null or p_status = '' or r.status = p_status);
end $$;

create or replace function public.admin_decide_refund(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.refunds;
begin
  perform public.require_admin();
  select * into r from public.refunds where id = p_id;
  if not found or r.status <> 'requested' then perform public.raise_app('INVALID', '処理待ちの返金申請ではありません'); end if;
  if p_approve then
    update public.refunds set status = 'approved' where id = p_id;
    perform public.process_refund(p_id);
  else
    update public.refunds set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_id;
    perform public.notify(r.requested_by, 'payment', '返金申請の結果', '今回の返金申請は承認されませんでした。詳細は問い合わせへ', null);
  end if;
  perform public.audit('admin.refund', 'refund', p_id::text, jsonb_build_object('approve', p_approve));
  return public.admin_list_refunds(null);
end $$;

-- ---------------------------------------------------------------- reports / audit / inquiries / deletion
create or replace function public.admin_list_reports(p_status text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'category', r.category, 'detail', r.detail, 'status', r.status,
    'admin_note', r.admin_note, 'created_at', r.created_at, 'booking_id', r.booking_id,
    'reporter', jsonb_build_object('id', a.id, 'display_name', a.display_name, 'role', a.role),
    'target', jsonb_build_object('id', t.id, 'display_name', t.display_name, 'role', t.role, 'status', t.status),
    'message', (select m.body from public.messages m where m.id = r.message_id)) order by r.created_at desc), '[]')
    from public.reports r join public.profiles a on a.id = r.reporter_id join public.profiles t on t.id = r.target_user_id
    where p_status is null or p_status = '' or r.status::text = p_status);
end $$;

create or replace function public.admin_update_report(p_id uuid, p_status public.report_status, p_note text, p_suspend boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  perform public.require_admin();
  update public.reports set status = p_status, admin_note = coalesce(p_note, ''),
    resolved_by = case when p_status in ('actioned', 'dismissed') then auth.uid() end,
    resolved_at = case when p_status in ('actioned', 'dismissed') then now() end where id = p_id returning * into r;
  if r.id is null then perform public.raise_app('NOT_FOUND', '通報が見つかりません'); end if;
  if coalesce(p_suspend, false) then
    perform public.admin_set_user_status(r.target_user_id, 'suspended', coalesce(p_note, '利用規約違反の疑い'));
  end if;
  perform public.recompute_user(r.target_user_id, 'report_' || p_status);
  perform public.audit('admin.report', 'report', p_id::text, jsonb_build_object('status', p_status, 'suspend', p_suspend));
  return public.admin_list_reports(null);
end $$;

create or replace function public.admin_list_audit(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'target_type', e.target_type, 'target_id', e.target_id,
    'detail', e.detail, 'created_at', e.created_at, 'actor', p.display_name) order by e.id desc), '[]')
    from (select * from public.audit_events order by id desc limit least(coalesce(p_limit, 100), 500)) e
    left join public.profiles p on p.id = e.actor_id);
end $$;

create or replace function public.admin_list_inquiries(p_status text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'category', i.category, 'body', i.body, 'status', i.status,
    'admin_reply', i.admin_reply, 'created_at', i.created_at, 'user', jsonb_build_object('id', p.id, 'display_name', p.display_name,
    'role', p.role, 'status', p.status)) order by i.created_at desc), '[]')
    from public.inquiries i join public.profiles p on p.id = i.user_id
    where p_status is null or p_status = '' or i.status = p_status);
end $$;

create or replace function public.admin_reply_inquiry(p_id uuid, p_reply text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  perform public.require_admin();
  update public.inquiries set admin_reply = p_reply, status = p_status, updated_at = now() where id = p_id returning user_id into u;
  if u is null then perform public.raise_app('NOT_FOUND', '問い合わせが見つかりません'); end if;
  perform public.notify(u, 'support', '問い合わせへの回答があります', left(coalesce(p_reply, ''), 80), '/support');
  perform public.audit('admin.inquiry', 'inquiry', p_id::text, jsonb_build_object('status', p_status));
  return public.admin_list_inquiries(null);
end $$;

-- 退会処理: 個人を特定できる情報を消去・匿名化。予約・決済・台帳は会計・紛争対応のため匿名状態で保持。
create or replace function public.admin_process_deletion(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if (select status from public.profiles where id = p_user) <> 'deletion_requested' then
    perform public.raise_app('INVALID', '退会申請中のユーザーではありません');
  end if;
  delete from public.profile_photos where user_id = p_user;
  delete from public.venue_references where woman_id = p_user;
  delete from public.share_links where woman_id = p_user;
  delete from public.notifications where user_id = p_user;
  update public.messages set body = '（退会したユーザーのメッセージは削除されました）' where sender_id = p_user;
  update public.women_profiles set headline = '', bio = '', ng_note = '', areas = '{}', is_published = false where user_id = p_user;
  update public.men_profiles set bio = '' where user_id = p_user;
  update public.verification_states set birth_year = null where user_id = p_user;
  update public.profiles set display_name = '退会済みユーザー', area = '', status = 'deleted', updated_at = now() where id = p_user;
  update auth.users set email = 'deleted+' || p_user::text || '@invalid.local', encrypted_password = '' where id = p_user;
  perform public.audit('admin.deletion_processed', 'user', p_user::text, '{}');
  return jsonb_build_object('status', 'deleted');
end $$;

create or replace function public.admin_payment_status() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'payment_mode', public.setting('payment_mode'),
    'providers', jsonb_build_array(
      jsonb_build_object('name', 'sandbox', 'status', 'active', 'note', '疑似決済。実請求・実送金は行われません'),
      jsonb_build_object('name', 'app_store / google_play（RevenueCat 想定）', 'status', 'not_configured', 'note', 'デジタル会員機能（サブスク）用。ストア審査・契約後に設定'),
      jsonb_build_object('name', '決済代行（Stripe 等）', 'status', 'not_configured', 'note', '対面の予約サービス用。事業者審査・法令確認後に設定')),
    'counts', (select jsonb_object_agg(k, n) from (select kind::text || ':' || status::text k, count(*) n from public.payments group by 1) s),
    'sandbox_payments', (select count(*) from public.payments where is_sandbox),
    'live_payments', (select count(*) from public.payments where not is_sandbox));
end $$;

-- 開発・デモ用: サンドボックス利用額を付与（実決済ではない旨を記録）
create or replace function public.admin_sandbox_credit_spend(p_user uuid, p_amount int, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  perform public.assert_sandbox();
  if (select role from public.profiles where id = p_user) <> 'man' then perform public.raise_app('INVALID', '男性会員のみ対象です'); end if;
  insert into public.payments (user_id, kind, amount, status, provider, is_sandbox, captured_at, note)
    values (p_user, 'adjustment', p_amount, 'captured', 'sandbox', true, now(), coalesce(p_note, 'デモ用利用額'));
  perform public.audit('admin.sandbox_credit', 'user', p_user::text, jsonb_build_object('amount', p_amount));
  perform public.recompute_man(p_user, 'sandbox_credit');
  return public.admin_get_user(p_user);
end $$;

create or replace function public.admin_expire_entitlement(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.membership_entitlements set status = 'expired', updated_at = now() where user_id = p_user and status = 'active';
  perform public.audit('admin.expire_entitlement', 'user', p_user::text, '{}');
  return public.admin_get_user(p_user);
end $$;

-- 期限切れサブスクの失効（pg_cron などから定期実行する想定）
create or replace function public.expire_entitlements() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.membership_entitlements set status = 'expired', updated_at = now()
    where status = 'active' and current_period_end <= now() and cancel_at_period_end;
  get diagnostics n = row_count;
  -- 自動更新（サンドボックスのみ。本番はストア/決済事業者の Webhook で更新）
  update public.membership_entitlements set current_period_end = current_period_end + interval '30 days', updated_at = now()
    where status = 'active' and current_period_end <= now() and not cancel_at_period_end and source = 'sandbox';
  return n;
end $$;
