export type Role = 'woman' | 'man' | 'admin';
export type VerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type BookingStatus = 'requested' | 'accepted' | 'declined' | 'canceled' | 'completed' | 'disputed';
export type AcceptMode = 'select' | 'open';

export type Badge = { code: string; label: string; earned: boolean };

export type Access = {
  spend_rank: string;
  plan_code: string;
  plan_rank: string;
  unlocked_rank: string;
  unlocked_sort: number;
  verified: boolean;
  source: 'plan' | 'spend';
};

export type Me = {
  id: string;
  role: Role;
  display_name: string;
  area: string;
  status: 'active' | 'suspended' | 'deletion_requested' | 'deleted';
  status_reason: string | null;
  created_at: string;
  verification: { status: VerificationStatus; method: string | null; submitted_at: string | null; rejection_reason: string | null };
  photos: string[];
  photo_items: { id: string; path: string; status: string }[];
  unread_notifications: number;
  badges: Badge[];
  woman?: {
    headline: string; bio: string; areas: string[]; plan_types: string[]; accept_mode: AcceptMode; accept_requests: boolean;
    min_man_level: number; ng_note: string; is_published: boolean; rank_code: string; rank_score: number; xp: number; level: number;
    level_floor_xp: number; next_level_xp: number;
    venue: { id: string; name: string; area: string; is_public: boolean; verify_status: VerificationStatus } | null;
  };
  man?: { bio: string; spend_total: number; spend_rank: string; xp: number; level: number; level_floor_xp: number; next_level_xp: number };
  access?: Access;
  entitlement?: { plan_code: string; status: string; current_period_end: string; cancel_at_period_end: boolean; source: string } | null;
};

export type Slot = { id: string; start_at: string; end_at: string; area: string; plan_type: string; price: number; note: string; my_request?: BookingStatus | null; status?: string; pending_requests?: number };

export type WomanCard = {
  id: string; display_name: string; headline: string; area: string; areas: string[]; rank_code: string; level: number;
  accept_mode: AcceptMode; accept_requests: boolean; plan_types: string[]; photos: string[];
  venue: { name: string; area: string } | null;
  next_slot: { start_at: string; end_at: string; price: number; plan_type: string } | null;
  locked: boolean;
};

export type Reason = { code: string; message: string };

export type WomanDetail = WomanCard & {
  bio: string;
  slots: Slot[];
  eligibility: { can_request: boolean; can_apply: boolean; rank_locked: boolean; application_status: string | null; application_source: string | null; reasons: Reason[]; access: Access } | null;
  conversation_id: string | null;
  badges: Badge[] | null;
};

export type ManSummary = { id: string; display_name: string; area: string; level: number; bio: string; verified: boolean; completed: number; photos: string[]; joined_at: string };

export type BookingDetail = {
  id: string; status: BookingStatus; start_at: string; end_at: string; area: string; plan_type: string; price: number; message: string;
  decline_reason: string | null; cancel_reason: string | null; created_at: string; accepted_at: string | null; completed_at: string | null;
  my_side: 'man' | 'woman' | 'admin';
  woman: Omit<WomanCard, 'locked' | 'next_slot'>;
  man: ManSummary;
  conversation_id: string | null;
  payment: { status: string; amount: number | null; is_sandbox: boolean } | null;
  earning: { gross: number | null; fee: number | null; net: number | null } | null;
  refund: { status: string; amount: number } | null;
  events: { to: BookingStatus; from: BookingStatus | null; at: string; by: string }[];
  cancellation_policy: { free_until_hours: number; late_fee_rate: number; note: string };
};

export type BookingListItem = {
  id: string; status: BookingStatus; start_at: string; end_at: string; area: string; plan_type: string; price: number;
  counterpart: { id: string; display_name: string; photos: string[]; rank_code?: string };
};

export type Plan = { code: string; name: string; monthly_price: number; unlock_rank: string; perks: string[]; is_demo_price: boolean };
export type RankRule = { audience?: string; code: string; label: string; min_value: number; sort: number };

export type MembershipOverview = {
  payment_mode: string;
  plans: Plan[];
  rank_rules: RankRule[];
  access: Access;
  entitlement: Me['entitlement'];
  spend_total: number; spend_rank: string;
  next_spend_rank: { code: string; min_value: number } | null;
  level: number; xp: number; level_floor_xp: number; next_level_xp: number;
  badges: Badge[];
  payments: { id: string; kind: string; amount: number; status: string; is_sandbox: boolean; plan_code: string | null; booking_id: string | null; created_at: string }[];
};

export type Conversation = {
  id: string; can_chat: boolean;
  counterpart: { id: string; display_name: string; photos: string[]; role: Role };
  last_message: { body: string; created_at: string; mine: boolean } | null;
  unread: number;
};

export type Message = { id: number; body: string; created_at: string; mine: boolean };

export type Notification = { id: number; kind: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export type WomanDashboard = {
  pending_applications: number; pending_bookings: number; month_net: number; total_net: number; is_sandbox: boolean;
  /** 今月完了した予約の件数（確定報酬の根拠） */
  month_completed: number;
  /** 予定: 予約確定済み・未完了の見込み額（手数料控除後、まだ確定していない） */
  expected_net: number; expected_count: number;
  /** 保留: 申立て中で運営の判断待ちの額 */
  held_net: number; held_count: number;
  is_top_rank: boolean; rank_floor: number;
  upcoming: { id: string; start_at: string; end_at: string; area: string; plan_type: string; man_name: string }[];
  rank_code: string; rank_score: number; next_rank: { code: string; min_value: number } | null;
  rank_breakdown: { profile: number; review: number; venue: number; earnings: number; record: number; penalty: number; inputs: Record<string, unknown> } | null;
  level: number; xp: number; level_floor_xp: number; next_level_xp: number; completed: number;
  is_published: boolean; accept_mode: AcceptMode; accept_requests: boolean; badges: Badge[];
};

export type Incoming = {
  applications: { id: string; message: string; status: string; source: string; created_at: string; man: ManSummary }[];
  bookings: { id: string; start_at: string; end_at: string; area: string; plan_type: string; price: number; message: string; status: BookingStatus; created_at: string; man: ManSummary }[];
  customers: { man: ManSummary; source: string; conversation_id: string | null }[];
};

export type PublicSettings = {
  settings: Record<string, unknown>;
  plans: Plan[];
  rank_rules: RankRule[];
};
