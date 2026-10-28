-- RLS と権限。クライアント(anon/authenticated)にはテーブルへの書き込み権限を一切与えない。
-- 読み取りは本人・当事者・管理者に限定。書き込みはすべて検証付き RPC を経由する。

do $$
declare t text;
begin
  foreach t in array array['app_settings','profiles','women_profiles','men_profiles','venue_references','profile_photos',
    'verification_states','availability_slots','membership_plans','membership_entitlements','rank_rules','rank_snapshots',
    'applications','bookings','booking_events','conversations','messages','conversation_reads','payments','earnings_ledger',
    'refunds','reports','blocks','inquiries','audit_events','notifications','share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- service_role / テーブル所有者は RLS をバイパスする（security definer 関数・Edge Functions の Webhook 処理用）
-- 読み取り権限（行はポリシーで制限）
grant select on public.app_settings, public.membership_plans, public.rank_rules to anon, authenticated;
grant select on public.profiles, public.men_profiles, public.venue_references, public.profile_photos,
  public.verification_states, public.availability_slots, public.membership_entitlements, public.rank_snapshots,
  public.applications, public.bookings, public.booking_events, public.conversations, public.messages, public.conversation_reads,
  public.payments, public.earnings_ledger, public.refunds, public.reports, public.blocks, public.inquiries,
  public.audit_events, public.notifications, public.share_links to authenticated;
-- 女性プロフィールは運営の非公開キュレーション列（review_score / review_note）を除外して付与
grant select (user_id, headline, bio, areas, plan_types, accept_mode, accept_requests, min_man_level, ng_note, is_published,
  rank_code, rank_score, xp, level, updated_at) on public.women_profiles to authenticated;

create policy settings_read on public.app_settings for select to anon, authenticated using (is_public or public.is_admin());
create policy plans_read on public.membership_plans for select to anon, authenticated using (is_active or public.is_admin());
create policy rank_rules_read on public.rank_rules for select to anon, authenticated using (true);

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy women_self on public.women_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy men_self on public.men_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy venue_self on public.venue_references for select to authenticated using (woman_id = auth.uid() or public.is_admin());
create policy photos_self on public.profile_photos for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy verification_self on public.verification_states for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy slots_self on public.availability_slots for select to authenticated using (woman_id = auth.uid() or public.is_admin());
create policy entitlements_self on public.membership_entitlements for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy snapshots_self on public.rank_snapshots for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy applications_party on public.applications for select to authenticated
  using (man_id = auth.uid() or woman_id = auth.uid() or public.is_admin());
create policy bookings_party on public.bookings for select to authenticated
  using (man_id = auth.uid() or woman_id = auth.uid() or public.is_admin());
create policy booking_events_party on public.booking_events for select to authenticated
  using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and auth.uid() in (b.man_id, b.woman_id)));

-- チャット: 当事者のみ。ブロック後は当事者も参照不可（Realtime の配信判定にも適用される）
create policy conversations_party on public.conversations for select to authenticated
  using ((auth.uid() in (man_id, woman_id) and not public.is_blocked_pair(man_id, woman_id)) or public.is_admin());
create policy messages_party on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id
                 and auth.uid() in (c.man_id, c.woman_id) and not public.is_blocked_pair(c.man_id, c.woman_id))
         or public.is_admin());
create policy reads_self on public.conversation_reads for select to authenticated using (user_id = auth.uid());

-- お金: 本人と管理者のみ。女性は自分の台帳のみ（男性の支払額は見えない）
create policy payments_self on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy earnings_self on public.earnings_ledger for select to authenticated using (woman_id = auth.uid() or public.is_admin());
create policy refunds_self on public.refunds for select to authenticated using (requested_by = auth.uid() or public.is_admin());

create policy reports_self on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy blocks_self on public.blocks for select to authenticated using (blocker_id = auth.uid() or public.is_admin());
create policy inquiries_self on public.inquiries for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy audit_admin on public.audit_events for select to authenticated using (public.is_admin());
create policy notifications_self on public.notifications for select to authenticated using (user_id = auth.uid());
create policy share_links_self on public.share_links for select to authenticated using (woman_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- function execute privileges
-- 既定では public スキーマの関数は誰でも実行できるため、一旦すべて剥奪してから公開 RPC のみ付与する。
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- RLS ポリシー内で使う読み取り専用ヘルパー
grant execute on function public.is_admin(), public.my_role(), public.is_blocked_pair(uuid, uuid) to anon, authenticated;

grant execute on function public.get_public_settings(), public.get_share_link_preview(text) to anon, authenticated;

grant execute on function
  public.get_me(), public.update_my_profile(text, text, text), public.submit_verification(int, boolean),
  public.list_notifications(int), public.mark_notifications_read(),
  public.search_women(text, text, date, boolean, text, int, int), public.get_woman_detail(uuid),
  public.membership_overview(), public.sandbox_subscribe(text), public.cancel_subscription(), public.resume_subscription(),
  public.submit_application(uuid, text), public.request_booking(uuid, text), public.redeem_share_link(text),
  public.update_woman_profile(text, text, text, text, text[], text[], boolean),
  public.set_accept_settings(public.accept_mode, boolean, int, text), public.upsert_venue(text, text, boolean), public.delete_venue(),
  public.add_photo(text), public.delete_photo(uuid), public.make_photo_primary(uuid),
  public.create_slot(timestamptz, timestamptz, text, text, int, text), public.list_my_slots(), public.close_slot(uuid),
  public.list_incoming(), public.decide_application(uuid, boolean),
  public.accept_booking(uuid), public.decline_booking(uuid, text), public.complete_booking(uuid), public.cancel_booking(uuid, text),
  public.open_dispute(uuid, text), public.request_refund(uuid, text),
  public.get_booking(uuid), public.list_my_bookings(text), public.woman_dashboard(), public.get_earnings(), public.get_share_link(boolean),
  public.list_conversations(), public.get_messages(uuid, bigint), public.send_message(uuid, text),
  public.block_user(uuid), public.unblock_user(uuid), public.list_blocks(),
  public.report_user(uuid, text, text, uuid, bigint), public.submit_inquiry(text, text), public.list_my_inquiries(),
  public.request_account_deletion(text),
  -- 管理系（関数内で require_admin により検証）
  public.admin_dashboard(), public.admin_list_users(text, text, text, text), public.admin_get_user(uuid),
  public.admin_set_verification(uuid, public.verification_status, text), public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_set_review(uuid, int, text), public.admin_set_venue_status(uuid, public.verification_status), public.admin_review_queue(),
  public.admin_moderate_photo(uuid, text), public.admin_list_settings(), public.admin_update_setting(text, jsonb),
  public.admin_upsert_plan(text, text, int, text, jsonb, boolean, int), public.admin_upsert_rank_rule(text, text, text, numeric, int),
  public.admin_list_bookings(text), public.admin_resolve_dispute(uuid, text, text), public.admin_list_refunds(text),
  public.admin_decide_refund(uuid, boolean), public.admin_list_reports(text),
  public.admin_update_report(uuid, public.report_status, text, boolean), public.admin_list_audit(int),
  public.admin_list_inquiries(text), public.admin_reply_inquiry(uuid, text, text), public.admin_process_deletion(uuid),
  public.admin_payment_status(), public.admin_sandbox_credit_spend(uuid, int, text), public.admin_expire_entitlement(uuid)
to authenticated;
