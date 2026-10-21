export type Role = "customer" | "business" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  notify_email: number;
  notify_browser: number;
  created_at: string;
  last_login_at: string | null;
  /** 1 = sample account created by the demo seed */
  is_demo: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  monthly_price: number;
  match_limit: number;
  success_fee_rate: number;
  description: string;
  active: number;
  sort: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  group_name: string;
  description: string;
  icon: string;
  price_min: number;
  price_max: number;
  price_note: string;
  concerns: string; // JSON string[]
  active: number;
  sort: number;
}

export interface Area {
  id: string;
  prefecture: string;
  city: string;
  region: string;
  postal_prefixes: string;
  active: number;
  sort: number;
}

export type CompanyStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Company {
  id: string;
  /** 1 = sample company created by the demo seed */
  is_demo: number;
  name: string;
  name_kana: string;
  status: CompanyStatus;
  address: string;
  phone: string;
  email: string;
  contact_person: string;
  tagline: string;
  description: string;
  specialties: string;
  warranty: string;
  self_construction: number;
  price_band_min: number;
  price_band_max: number;
  lead_time_weeks: number;
  website_url: string;
  sns_url: string;
  business_hours: string;
  license_number: string;
  corporate_number: string;
  qualifications: string;
  founded_year: number | null;
  employees: number | null;
  works_total: number;
  rating_avg: number;
  review_count: number;
  avg_response_minutes: number;
  logo_file_id: string | null;
  brand_color: string;
  plan_id: string | null;
  trial_ends_at: string | null;
  web_interest: number;
  created_at: string;
  approved_at: string | null;
}

export type ProjectStatus =
  | "consulting"
  | "quoting"
  | "comparing"
  | "contracted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Project {
  id: string;
  customer_id: string;
  category_id: string;
  area_id: string | null;
  title: string;
  postal_code: string;
  prefecture: string;
  city: string;
  house_type: string;
  building_age: number | null;
  concerns: string;
  details: string;
  desired_timing: string;
  budget_min: number | null;
  budget_max: number | null;
  contact_time: string;
  estimate_min: number | null;
  estimate_max: number | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  project_id: string;
  company_id: string;
  score: number;
  reasons: string; // JSON string[]
  customer_interest: number;
  customer_interest_at: string | null;
  customer_saved: number;
  customer_passed: number;
  customer_match_seen_at: string | null;
  company_match_seen_at: string | null;
  company_response: "none" | "yes" | "no";
  company_response_at: string | null;
  status: "candidate" | "matched" | "closed";
  matched_at: string | null;
  customer_last_read_at: string | null;
  company_last_read_at: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_user_id: string | null;
  sender_side: "customer" | "company" | "system";
  kind: "text" | "image" | "file" | "quote" | "system";
  body: string;
  file_id: string | null;
  quote_id: string | null;
  contact_flags: string;
  created_at: string;
}

export interface Quote {
  id: string;
  match_id: string;
  project_id: string;
  company_id: string;
  created_by: string | null;
  version: number;
  status: "submitted" | "superseded" | "accepted" | "declined";
  title: string;
  subtotal: number;
  overhead: number;
  discount: number;
  tax: number;
  total: number;
  warranty: string;
  warranty_years: number;
  duration: string;
  duration_days: number | null;
  materials: string;
  payment_terms: string;
  extra_costs: string;
  notes: string;
  valid_until: string | null;
  pdf_file_id: string | null;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  sort: number;
}

export interface Contract {
  id: string;
  project_id: string;
  company_id: string;
  match_id: string;
  quote_id: string | null;
  amount: number;
  contract_date: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_file_id: string | null;
  status: "contracted" | "in_progress" | "completed" | "cancelled";
  success_fee_rate: number;
  notes: string;
  created_at: string;
  updated_at: string;
  /** selected = 依頼先決定 / terms = 契約条件の確認中 / agreed = 双方の合意確認済み / contracted = 契約成立 */
  stage: ContractStage;
  terms_json: string;
  terms_hash: string;
  customer_agreed_at: string | null;
  customer_agreed_by: string | null;
  company_agreed_at: string | null;
  company_agreed_by: string | null;
  agreed_at: string | null;
  contract_file_hash: string;
  customer_doc_confirmed_at: string | null;
  customer_doc_confirmed_by: string | null;
  company_doc_confirmed_at: string | null;
  company_doc_confirmed_by: string | null;
  established_at: string | null;
}

export type ContractStage = "selected" | "terms" | "agreed" | "contracted";

export interface ContractContact {
  contract_id: string;
  side: "customer" | "company";
  name: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  updated_by: string | null;
  updated_at: string;
}

/** What both sides confirm before the work starts. Every field is required; amount comes from the quote. */
export interface ContractTerms {
  quote_id: string;
  quote_version: number;
  amount: number; // 税込
  scope: string; // 工事範囲
  start_date: string; // 工事開始予定日 YYYY-MM-DD
  duration: string; // 工期
  payment_terms: string; // 支払条件
  materials: string; // 材料・仕様
  extra_work: string; // 追加工事が必要になった時の対応
  warranty: string; // 保証
  cancellation: string; // キャンセル条件
}

export interface Review {
  id: string;
  company_id: string;
  project_id: string | null;
  customer_id: string | null;
  rating: number;
  title: string;
  body: string;
  author_label: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface FileRow {
  id: string;
  owner_user_id: string | null;
  scope: "public" | "project" | "match" | "contract";
  scope_id: string | null;
  mime: string;
  size: number;
  original_name: string;
  storage_path: string;
  created_at: string;
}

export interface CompanyWork {
  id: string;
  company_id: string;
  category_id: string | null;
  title: string;
  city: string;
  cost_label: string;
  image_url: string | null;
  file_id: string | null;
  created_at: string;
}

export interface SiteVisit {
  id: string;
  match_id: string;
  company_id: string;
  proposed_by: string;
  slots_json: string;
  note: string;
  status: "proposed" | "approved" | "declined" | "cancelled";
  visit_at: string | null;
  address_enc: string | null;
  access_note_enc: string | null;
  consent_json: string | null;
  approved_by: string | null;
  approved_at: string | null;
  visible_until: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}
