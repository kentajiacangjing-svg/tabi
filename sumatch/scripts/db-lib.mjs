// Shared helpers for the data scripts (inspect / backup / restore / reset). Plain Node, no app imports.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");
export const DB_PATH = path.join(STORAGE_DIR, "sumatch.db");
export const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || "./backups");

export const sha256File = (p) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const DEMO_EMAIL = "(email LIKE '%@demo.sumatch.jp' OR email LIKE '%@%.demo')";

/** Counts that tell sample data from real data. Opens the database read-only; changes nothing. */
export function inspect(dbPath = DB_PATH) {
  if (!fs.existsSync(dbPath)) return { exists: false };
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  const n = (sql) => db.prepare(sql).get().n;
  // Older databases have no is_demo column yet: fall back to the fixed demo addresses.
  const demoUser = has("users", "is_demo") ? "u.is_demo = 1" : DEMO_EMAIL.replaceAll("email", "u.email");
  const out = {
    exists: true,
    path: dbPath,
    users: {
      demo: n(`SELECT COUNT(*) n FROM users u WHERE ${demoUser}`),
      real: n(`SELECT COUNT(*) n FROM users u WHERE NOT (${demoUser})`),
      realByRole: db.prepare(`SELECT role, COUNT(*) n FROM users u WHERE NOT (${demoUser}) GROUP BY role`).all(),
    },
    companies: {
      total: n("SELECT COUNT(*) n FROM companies"),
      demo: has("companies", "is_demo") ? n("SELECT COUNT(*) n FROM companies WHERE is_demo = 1") : null,
    },
    projects: {
      total: n("SELECT COUNT(*) n FROM projects"),
      byRealCustomers: n(`SELECT COUNT(*) n FROM projects p JOIN users u ON u.id = p.customer_id WHERE NOT (${demoUser})`),
    },
    quotes: n("SELECT COUNT(*) n FROM quotes"),
    messages: n("SELECT COUNT(*) n FROM messages"),
    contracts: {
      total: n("SELECT COUNT(*) n FROM contracts"),
      byStatus: db.prepare(`SELECT status, ${has("contracts", "stage") ? "stage" : "'(no stage column)' AS stage"}, COUNT(*) n FROM contracts GROUP BY 1, 2`).all(),
      ofRealCustomers: n(`SELECT COUNT(*) n FROM contracts c JOIN projects p ON p.id = c.project_id JOIN users u ON u.id = p.customer_id WHERE NOT (${demoUser})`),
      // Work started or finished without a 契約成立 record (contract document confirmed by both): review one by one.
      needsReview: n(`SELECT COUNT(*) n FROM contracts WHERE status IN ('in_progress','completed')${has("contracts", "stage") ? " AND stage != 'contracted'" : ""}`),
    },
    uploads: fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0,
  };
  db.close();
  out.hasRealData = out.users.real > 0 || out.projects.byRealCustomers > 0;
  return out;
}

/** Consistent copy of the database (VACUUM INTO) plus the uploads, with a manifest of hashes. Read-only on the source. */
export function backup(label = "manual") {
  if (!fs.existsSync(DB_PATH)) throw new Error(`データベースがありません: ${DB_PATH}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(BACKUP_DIR, `${stamp}-${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA busy_timeout = 5000");
  db.prepare("VACUUM INTO ?").run(path.join(dir, "sumatch.db"));
  db.close();
  let files = 0;
  if (fs.existsSync(UPLOAD_DIR)) {
    fs.cpSync(UPLOAD_DIR, path.join(dir, "uploads"), { recursive: true });
    files = fs.readdirSync(UPLOAD_DIR).length;
  }
  const manifest = {
    created_at: new Date().toISOString(),
    source: DB_PATH,
    db_sha256: sha256File(path.join(dir, "sumatch.db")),
    upload_files: files,
    summary: inspect(path.join(dir, "sumatch.db")),
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { dir, manifest };
}

export const hasFlag = (f) => process.argv.includes(f);
