-- PROJECT GOLD (仮称) — コアスキーマ
-- 方針:
--  * ランク・利用額・報酬・支払い状態・管理者権限はすべてサーバー側（このDB内の関数）で確定する。
--  * クライアントは原則 RPC（public.* の security definer 関数）経由で書き込む。テーブルへの直接
--    INSERT/UPDATE/DELETE 権限は authenticated に付与しない（20261028000005_rls.sql 参照）。
--  * 店舗予約・指名・ボトル注文はフェーズ2。bookings.kind / venue_references で拡張余地のみ確保。

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.user_role as enum ('woman', 'man', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deletion_requested', 'deleted');
create type public.verification_status as enum ('unsubmitted', 'pending', 'approved', 'rejected');
create type public.accept_mode as enum ('select', 'open'); -- select=自分で選ぶ / open=幅広く受け付ける
create type public.booking_status as enum ('requested', 'accepted', 'declined', 'canceled', 'completed', 'disputed');
create type public.application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.payment_status as enum ('pending', 'authorized', 'captured', 'voided', 'refunded', 'failed');
create type public.payment_kind as enum ('subscription', 'booking', 'adjustment');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- ---------------------------------------------------------------- settings
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  is_public boolean not null default false, -- true: 一般ユーザーも参照可（料金表示・サービス名など）
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null default '',
  area text not null default '',
  status public.account_status not null default 'active',
  status_reason text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_name_len check (char_length(display_name) <= 30)
);

create table public.women_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  areas text[] not null default '{}',
  plan_types text[] not null default '{食事,カフェ}',
  accept_mode public.accept_mode not null default 'select',
  accept_requests boolean not null default true,
  min_man_level int not null default 1,
  ng_note text not null default '',          -- 本人と運営のみ参照
  is_published boolean not null default false,
  review_score int not null default 50,       -- 運営の非公開キュレーション(0-100)。本人にも非公開
  review_note text not null default '',       -- 運営メモ（非公開）
  rank_code text not null default 'C',
  rank_score numeric(6,2) not null default 0,
  xp int not null default 0,
  level int not null default 1,
  updated_at timestamptz not null default now(),
  constraint bio_len check (char_length(bio) <= 1000),
  constraint headline_len check (char_length(headline) <= 60),
  constraint review_score_range check (review_score between 0 and 100)
);

create table public.men_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null default '',
  spend_total int not null default 0,          -- 確定済み利用額（返金控除後）。相手方へは非公開
  spend_rank_code text not null default 'C',
  xp int not null default 0,
  level int not null default 1,
  updated_at timestamptz not null default now(),
  constraint men_bio_len check (char_length(bio) <= 500)
);

-- 所属店舗（任意）。公開は is_public かつ運営確認済みの場合のみ。売上額は扱わない。
create table public.venue_references (
  id uuid primary key default gen_random_uuid(),
  woman_id uuid not null references public.profiles (id) on delete cascade,
  venue_name text not null,
  area text not null default '',
  is_public boolean not null default false,
  verify_status public.verification_status not null default 'pending',
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint venue_name_len check (char_length(venue_name) between 1 and 60)
);
create unique index venue_one_per_woman on public.venue_references (woman_id);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index profile_photos_user on public.profile_photos (user_id, sort_order);

create table public.verification_states (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.verification_status not null default 'unsubmitted',
  method text not null default 'none',        -- demo / provider:<name>。本人確認書類そのものは保存しない
  birth_year int,                              -- 年齢判定に必要な最小情報のみ
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  rejection_reason text
);

-- ---------------------------------------------------------------- availability / plans
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  woman_id uuid not null references public.profiles (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  area text not null default '',
  plan_type text not null default '食事',
  price int not null,
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'booked', 'closed')),
  created_at timestamptz not null default now(),
  constraint slot_time check (end_at > start_at and end_at - start_at <= interval '8 hours'),
  constraint slot_price check (price between 0 and 1000000)
);
create index slots_woman_time on public.availability_slots (woman_id, start_at);

create table public.membership_plans (
  code text primary key,
  name text not null,
  monthly_price int not null check (monthly_price >= 0),
  unlock_rank text not null,
  perks jsonb not null default '[]',
  sort int not null default 0,
  is_active boolean not null default true,
  is_demo_price boolean not null default true, -- 正式価格未確定のデモ値
  updated_at timestamptz not null default now()
);

create table public.membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null references public.membership_plans (code),
  status text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  source text not null default 'sandbox',      -- sandbox / app_store / google_play / stripe
  external_ref text,
  updated_at timestamptz not null default now()
);
create unique index one_active_entitlement on public.membership_entitlements (user_id) where status = 'active';

create table public.rank_rules (
  audience text not null check (audience in ('woman', 'man_spend')),
  code text not null,
  label text not null,
  min_value numeric not null,     -- woman: スコア下限 / man_spend: 確定利用額(円)下限
  sort int not null,              -- 大きいほど上位
  primary key (audience, code)
);

create table public.rank_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  audience text not null,
  rank_code text not null,
  score numeric not null,
  breakdown jsonb not null,
  reason text not null default '',
  computed_at timestamptz not null default now()
);
create index rank_snapshots_user on public.rank_snapshots (user_id, computed_at desc);

-- ---------------------------------------------------------------- matching
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  man_id uuid not null references public.profiles (id) on delete cascade,
  woman_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '',
  status public.application_status not null default 'pending',
  source text not null default 'request' check (source in ('request', 'invite')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (man_id, woman_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'companionship', -- フェーズ2: 'venue_visit' 等を追加予定
  man_id uuid not null references public.profiles (id),
  woman_id uuid not null references public.profiles (id),
  slot_id uuid references public.availability_slots (id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  area text not null default '',
  plan_type text not null default '',
  price int not null,
  man_message text not null default '',
  status public.booking_status not null default 'requested',
  decline_reason text,
  cancel_reason text,
  canceled_by uuid,
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_time check (end_at > start_at)
);
create index bookings_woman on public.bookings (woman_id, status, start_at);
create index bookings_man on public.bookings (man_id, status, start_at);
-- ダブルブッキングの最終防衛線（RPC 内でもロック＋重複チェックを行う）
alter table public.bookings add constraint no_double_booking_woman
  exclude using gist (woman_id with =, tstzrange(start_at, end_at) with &&) where (status = 'accepted');
alter table public.bookings add constraint no_double_booking_man
  exclude using gist (man_id with =, tstzrange(start_at, end_at) with &&) where (status = 'accepted');

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  man_id uuid not null references public.profiles (id) on delete cascade,
  woman_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (man_id, woman_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint body_len check (char_length(body) between 1 and 2000)
);
create index messages_conv on public.messages (conversation_id, id);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_id bigint not null default 0,
  primary key (conversation_id, user_id)
);

-- ---------------------------------------------------------------- money (sandbox until approved)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  kind public.payment_kind not null,
  booking_id uuid references public.bookings (id),
  plan_code text references public.membership_plans (code),
  amount int not null check (amount >= 0),
  currency text not null default 'JPY',
  status public.payment_status not null default 'pending',
  provider text not null default 'sandbox',
  provider_ref text,
  is_sandbox boolean not null default true,
  note text not null default '',
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user on public.payments (user_id, created_at desc);
create unique index one_booking_payment on public.payments (booking_id) where kind = 'booking';

-- 女性への支払管理は台帳まで。実送金は契約・法令確認後に実装（entry_type='payout' は予約語）。
create table public.earnings_ledger (
  id bigint generated always as identity primary key,
  woman_id uuid not null references public.profiles (id),
  booking_id uuid references public.bookings (id),
  payment_id uuid references public.payments (id),
  entry_type text not null check (entry_type in ('earning', 'reversal', 'payout')),
  gross int not null,
  fee int not null,
  net int not null,
  is_sandbox boolean not null default true,
  created_at timestamptz not null default now()
);
create index earnings_woman on public.earnings_ledger (woman_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  booking_id uuid references public.bookings (id),
  amount int not null check (amount > 0),
  reason text not null default '',
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'processed')),
  requested_by uuid references public.profiles (id),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- safety
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  target_user_id uuid not null references public.profiles (id),
  booking_id uuid references public.bookings (id),
  message_id bigint references public.messages (id) on delete set null,
  category text not null,
  detail text not null default '',
  status public.report_status not null default 'open',
  admin_note text not null default '',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('general', 'appeal', 'payment', 'safety', 'deletion')),
  body text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_created on public.audit_events (created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, id desc);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  woman_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  uses int not null default 0,
  created_at timestamptz not null default now()
);
create unique index one_active_share_link on public.share_links (woman_id) where is_active;
