// SUMATCH database schema.
// Written in portable SQL (TEXT ids, ISO timestamps) so it can be moved to
// Postgres / Supabase later with minimal changes. Every table has created_at.

export const SCHEMA = /* sql */ `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','business','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_browser INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_price INTEGER NOT NULL,
  match_limit INTEGER NOT NULL,
  success_fee_rate REAL NOT NULL DEFAULT 0.03,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '住まい',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'home',
  price_min INTEGER NOT NULL DEFAULT 0,
  price_max INTEGER NOT NULL DEFAULT 0,
  price_note TEXT NOT NULL DEFAULT '',
  concerns TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_areas (
  id TEXT PRIMARY KEY,
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  postal_prefixes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (prefecture, city)
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  specialties TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  self_construction INTEGER NOT NULL DEFAULT 1,
  price_band_min INTEGER NOT NULL DEFAULT 0,
  price_band_max INTEGER NOT NULL DEFAULT 0,
  lead_time_weeks INTEGER NOT NULL DEFAULT 4,
  website_url TEXT NOT NULL DEFAULT '',
  sns_url TEXT NOT NULL DEFAULT '',
  business_hours TEXT NOT NULL DEFAULT '',
  license_number TEXT NOT NULL DEFAULT '',
  corporate_number TEXT NOT NULL DEFAULT '',
  qualifications TEXT NOT NULL DEFAULT '',
  founded_year INTEGER,
  employees INTEGER,
  works_total INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  avg_response_minutes INTEGER NOT NULL DEFAULT 120,
  logo_file_id TEXT,
  brand_color TEXT NOT NULL DEFAULT '#3d3a35',
  plan_id TEXT REFERENCES plans(id),
  trial_ends_at TEXT,
  web_interest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS company_members (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'staff' CHECK (member_role IN ('owner','staff')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS company_categories (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  works_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, category_id)
);

CREATE TABLE IF NOT EXISTS company_areas (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL REFERENCES service_areas(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, area_id)
);

CREATE TABLE IF NOT EXISTS company_works (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id),
  title TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  cost_label TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  file_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  scope TEXT NOT NULL CHECK (scope IN ('public','project','match','contract')),
  scope_id TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  area_id TEXT REFERENCES service_areas(id),
  title TEXT NOT NULL,
  postal_code TEXT NOT NULL DEFAULT '',
  prefecture TEXT NOT NULL,
  city TEXT NOT NULL,
  house_type TEXT NOT NULL,
  building_age INTEGER,
  concerns TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  desired_timing TEXT NOT NULL,
  budget_min INTEGER,
  budget_max INTEGER,
  contact_time TEXT NOT NULL DEFAULT '',
  estimate_min INTEGER,
  estimate_max INTEGER,
  status TEXT NOT NULL DEFAULT 'consulting' CHECK (status IN ('consulting','quoting','comparing','contracted','in_progress','completed','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_images (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- One row per (project, eligible company). Both sides say yes => matched.
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  customer_interest INTEGER NOT NULL DEFAULT 0,
  customer_interest_at TEXT,
  customer_saved INTEGER NOT NULL DEFAULT 0,
  customer_passed INTEGER NOT NULL DEFAULT 0,
  customer_match_seen_at TEXT,
  company_match_seen_at TEXT,
  company_response TEXT NOT NULL DEFAULT 'none' CHECK (company_response IN ('none','yes','no')),
  company_response_at TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','matched','closed')),
  matched_at TEXT,
  customer_last_read_at TEXT,
  company_last_read_at TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, company_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sender_side TEXT NOT NULL CHECK (sender_side IN ('customer','company','system')),
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','file','quote','system')),
  body TEXT NOT NULL DEFAULT '',
  file_id TEXT REFERENCES files(id),
  quote_id TEXT,
  contact_flags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','superseded','accepted','declined')),
  title TEXT NOT NULL DEFAULT '',
  subtotal INTEGER NOT NULL DEFAULT 0,
  overhead INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  warranty TEXT NOT NULL DEFAULT '',
  warranty_years REAL NOT NULL DEFAULT 0,
  duration TEXT NOT NULL DEFAULT '',
  duration_days INTEGER,
  materials TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  extra_costs TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  valid_until TEXT,
  pdf_file_id TEXT REFERENCES files(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '式',
  unit_price INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Future: e-sign, escrow payment, warranty and progress tracking hang off this table.
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id),
  match_id TEXT NOT NULL REFERENCES matches(id),
  quote_id TEXT REFERENCES quotes(id),
  amount INTEGER NOT NULL,
  contract_date TEXT,
  start_date TEXT,
  end_date TEXT,
  contract_file_id TEXT REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'contracted' CHECK (status IN ('contracted','in_progress','completed','cancelled')),
  success_fee_rate REAL NOT NULL DEFAULT 0.03,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Who agreed to what, when. Append-only; each row's hash covers the previous row's hash, so editing or
-- deleting history breaks the chain (see verifyContractHistory).
CREATE TABLE IF NOT EXISTS contract_events (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  actor_side TEXT NOT NULL CHECK (actor_side IN ('customer','company','system')),
  actor_user_id TEXT,
  action TEXT NOT NULL,
  terms_hash TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  prev_hash TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (contract_id, seq)
);

-- A send refused because it contained contact details before the terms were agreed.
-- Only the kind of detail is kept — never the message text.
CREATE TABLE IF NOT EXISTS contact_blocks (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_user_id TEXT,
  sender_side TEXT NOT NULL,
  flags TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'message',
  created_at TEXT NOT NULL
);

-- Contact details for the people doing the work, exchanged only once the contract is established
-- (lib/contract.ts → contractEstablished). One row per side; never shown in chat.
CREATE TABLE IF NOT EXISTS contract_contacts (
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('customer','company')),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (contract_id, side)
);

-- Who looked at the other side's contact details, and when.
CREATE TABLE IF NOT EXISTS contact_access_log (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  viewer_user_id TEXT NOT NULL,
  viewer_side TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 現地調査 (site visit) before any contract. The company proposes dates; the customer picks one and, by explicit
-- consent, discloses the visit address to that company only. The address is encrypted, shown only to the
-- company's members until visible_until, and erased when the visit is cancelled or the period ends.
CREATE TABLE IF NOT EXISTS site_visits (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id),
  proposed_by TEXT NOT NULL,
  slots_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','declined','cancelled')),
  visit_at TEXT,
  address_enc TEXT,
  access_note_enc TEXT,
  consent_json TEXT,
  approved_by TEXT,
  approved_at TEXT,
  visible_until TEXT,
  closed_by TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL
);

-- Every step of a site visit, and every time the company opened the address. Never the address itself.
CREATE TABLE IF NOT EXISTS site_visit_events (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_side TEXT NOT NULL,
  actor_user_id TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- 成功報酬 (provisional rules, see lib/fees.ts): one internal record per 契約成立. Nothing here bills anyone;
-- statuses are set by the operator by hand. fee_events keeps who changed what.
CREATE TABLE IF NOT EXISTS fee_records (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL UNIQUE REFERENCES contracts(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  base_amount INTEGER NOT NULL,
  rate REAL NOT NULL,
  fee_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','invoiced','paid','void')),
  rule_version TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_events (
  id TEXT PRIMARY KEY,
  fee_id TEXT NOT NULL REFERENCES fee_records(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_user_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- Attempt counters for sign-in, sign-up and other abuse-prone actions (lib/rate-limit.ts). Shared by every
-- server process because it lives in the database.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_end TEXT NOT NULL
);

-- 退会申請. Recorded only; the operator handles each one by hand (retention periods are a legal decision).
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','handled','withdrawn')),
  note TEXT NOT NULL DEFAULT '',
  handled_by TEXT,
  handled_at TEXT,
  created_at TEXT NOT NULL
);

-- Operator (admin) access to private data: which chat or file, when. For audits of the operator itself.
CREATE TABLE IF NOT EXISTS admin_access_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT UNIQUE REFERENCES projects(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  author_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);

-- Outgoing email log. In the MVP this table is the mail transport; plug SMTP / LINE later.
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('match','company','user','message')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  user_id TEXT,
  session_key TEXT,
  meta TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_matches_project ON matches(project_id);
CREATE INDEX IF NOT EXISTS idx_matches_company ON matches(company_id);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_members_user ON company_members(user_id);
`;

/** Columns added after the first release. Applied with ALTER TABLE when missing. */
// `backfill` runs once, right after its column is added, on databases created before the column existed.
export const MIGRATIONS: { table: string; column: string; ddl: string; backfill?: string }[] = [
  { table: "matches", column: "customer_saved", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "matches", column: "customer_passed", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "matches", column: "customer_match_seen_at", ddl: "TEXT" },
  { table: "matches", column: "company_match_seen_at", ddl: "TEXT" },
  // 依頼先決定 → 契約条件の確認 → 双方合意. Rows created before this column existed start at 'selected':
  // nothing is shown as agreed unless both sides actually agreed.
  { table: "contracts", column: "stage", ddl: "TEXT NOT NULL DEFAULT 'selected'" },
  { table: "contracts", column: "terms_json", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "contracts", column: "terms_hash", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "contracts", column: "customer_agreed_at", ddl: "TEXT" },
  { table: "contracts", column: "customer_agreed_by", ddl: "TEXT" },
  { table: "contracts", column: "company_agreed_at", ddl: "TEXT" },
  { table: "contracts", column: "company_agreed_by", ddl: "TEXT" },
  { table: "contracts", column: "agreed_at", ddl: "TEXT" },
  // 契約成立 = agreed terms + a registered contract document that both sides confirmed (by file hash).
  { table: "contracts", column: "contract_file_hash", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "contracts", column: "customer_doc_confirmed_at", ddl: "TEXT" },
  { table: "contracts", column: "customer_doc_confirmed_by", ddl: "TEXT" },
  { table: "contracts", column: "company_doc_confirmed_at", ddl: "TEXT" },
  { table: "contracts", column: "company_doc_confirmed_by", ddl: "TEXT" },
  { table: "contracts", column: "established_at", ddl: "TEXT" },
  // Sample data is flagged so it can be told apart from real accounts and hidden outside demo mode.
  // Older databases: only the fixed demo addresses are flagged; nothing else is changed.
  {
    table: "users",
    column: "is_demo",
    ddl: "INTEGER NOT NULL DEFAULT 0",
    backfill: "UPDATE users SET is_demo = 1 WHERE email LIKE '%@demo.sumatch.jp' OR email LIKE '%@%.demo'",
  },
  {
    table: "companies",
    column: "is_demo",
    ddl: "INTEGER NOT NULL DEFAULT 0",
    backfill:
      "UPDATE companies SET is_demo = 1 WHERE id IN (SELECT m.company_id FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.member_role = 'owner' AND u.is_demo = 1)",
  },
  // Notification email delivery: queued → sending → sent | failed (retried) | suppressed. No mail leaves the
  // app unless a transport is configured (lib/mailer.ts); there is no real transport yet.
  // 成功報酬の試算: which base was used (税抜 / 税込) and the tax, so a record can be re-checked later.
  { table: "fee_records", column: "base_kind", ddl: "TEXT NOT NULL DEFAULT 'incl_tax'" },
  { table: "fee_records", column: "tax_amount", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "fee_records", column: "rounding", ddl: "TEXT NOT NULL DEFAULT 'round'" },
  { table: "email_outbox", column: "user_id", ddl: "TEXT" },
  { table: "email_outbox", column: "kind", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "email_outbox", column: "dedupe_key", ddl: "TEXT" },
  { table: "email_outbox", column: "attempts", ddl: "INTEGER NOT NULL DEFAULT 0" },
  { table: "email_outbox", column: "next_attempt_at", ddl: "TEXT" },
  { table: "email_outbox", column: "last_error", ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: "email_outbox", column: "sent_at", ddl: "TEXT" },
];

// Database-level guarantees that hold even if application code runs twice (double tap, retry, two processes).
export const INDEXES = `
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_once_both_agreed ON contract_events(contract_id, terms_hash) WHERE action = 'both_agreed';
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_once_established ON contract_events(contract_id) WHERE action = 'contract_established';
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_once_selected ON contract_events(contract_id) WHERE action = 'selected';
CREATE UNIQUE INDEX IF NOT EXISTS uq_outbox_dedupe ON email_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_status ON email_outbox(status, next_attempt_at);

-- Database-level audit (db_audit): changes to contracts, their history, fee records, user roles/status and
-- company status are recorded by triggers — whether made by the app or by someone editing the database file
-- directly with a SQLite tool. No personal data is copied: ids and state values only. Rows cannot be updated or
-- deleted through SQL. (Someone with full access to the file can still drop the triggers; this is evidence,
-- not prevention — see docs/data-operations.md.)
CREATE TABLE IF NOT EXISTS db_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  tbl TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE TRIGGER IF NOT EXISTS db_audit_no_update BEFORE UPDATE ON db_audit BEGIN SELECT RAISE(ABORT, 'db_audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS db_audit_no_delete BEFORE DELETE ON db_audit BEGIN SELECT RAISE(ABORT, 'db_audit is append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_contracts_update AFTER UPDATE ON contracts
WHEN OLD.stage IS NOT NEW.stage OR OLD.status IS NOT NEW.status OR OLD.amount IS NOT NEW.amount OR OLD.quote_id IS NOT NEW.quote_id
  OR OLD.contract_file_hash IS NOT NEW.contract_file_hash OR OLD.terms_hash IS NOT NEW.terms_hash
BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('contracts', NEW.id, 'update', json_object(
    'stage', json_array(OLD.stage, NEW.stage), 'status', json_array(OLD.status, NEW.status), 'amount', json_array(OLD.amount, NEW.amount),
    'quote_id', json_array(OLD.quote_id, NEW.quote_id), 'terms_hash', json_array(substr(OLD.terms_hash, 1, 12), substr(NEW.terms_hash, 1, 12)),
    'file_hash', json_array(substr(OLD.contract_file_hash, 1, 12), substr(NEW.contract_file_hash, 1, 12))));
END;
CREATE TRIGGER IF NOT EXISTS audit_contracts_delete AFTER DELETE ON contracts BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('contracts', OLD.id, 'delete', json_object('stage', OLD.stage, 'status', OLD.status, 'amount', OLD.amount));
END;
-- The app only ever appends to contract_events: any update or delete is a sign of tampering.
CREATE TRIGGER IF NOT EXISTS audit_contract_events_update AFTER UPDATE ON contract_events BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('contract_events', OLD.id, 'update', json_object('contract_id', OLD.contract_id, 'seq', OLD.seq, 'action', OLD.action));
END;
CREATE TRIGGER IF NOT EXISTS audit_contract_events_delete AFTER DELETE ON contract_events BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('contract_events', OLD.id, 'delete', json_object('contract_id', OLD.contract_id, 'seq', OLD.seq, 'action', OLD.action));
END;
CREATE TRIGGER IF NOT EXISTS audit_fee_records_update AFTER UPDATE ON fee_records
WHEN OLD.status IS NOT NEW.status OR OLD.fee_amount IS NOT NEW.fee_amount OR OLD.base_amount IS NOT NEW.base_amount OR OLD.rate IS NOT NEW.rate
BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('fee_records', NEW.id, 'update', json_object(
    'status', json_array(OLD.status, NEW.status), 'fee_amount', json_array(OLD.fee_amount, NEW.fee_amount),
    'base_amount', json_array(OLD.base_amount, NEW.base_amount), 'rate', json_array(OLD.rate, NEW.rate)));
END;
CREATE TRIGGER IF NOT EXISTS audit_fee_records_delete AFTER DELETE ON fee_records BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('fee_records', OLD.id, 'delete', json_object('contract_id', OLD.contract_id, 'status', OLD.status, 'fee_amount', OLD.fee_amount));
END;
CREATE TRIGGER IF NOT EXISTS audit_users_update AFTER UPDATE ON users
WHEN OLD.role IS NOT NEW.role OR OLD.status IS NOT NEW.status OR OLD.is_demo IS NOT NEW.is_demo OR OLD.email IS NOT NEW.email
BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('users', NEW.id, 'update', json_object(
    'role', json_array(OLD.role, NEW.role), 'status', json_array(OLD.status, NEW.status), 'is_demo', json_array(OLD.is_demo, NEW.is_demo),
    'email_changed', OLD.email IS NOT NEW.email));
END;
CREATE TRIGGER IF NOT EXISTS audit_users_delete AFTER DELETE ON users BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('users', OLD.id, 'delete', json_object('role', OLD.role));
END;
CREATE TRIGGER IF NOT EXISTS audit_companies_update AFTER UPDATE ON companies
WHEN OLD.status IS NOT NEW.status OR OLD.plan_id IS NOT NEW.plan_id OR OLD.is_demo IS NOT NEW.is_demo
BEGIN
  INSERT INTO db_audit (tbl, row_id, action, detail) VALUES ('companies', NEW.id, 'update', json_object(
    'status', json_array(OLD.status, NEW.status), 'plan_id', json_array(OLD.plan_id, NEW.plan_id), 'is_demo', json_array(OLD.is_demo, NEW.is_demo)));
END;
`;
