// 開発用 DB: PGlite（WASM 版 PostgreSQL）に Supabase 互換シム → 本番と同じマイグレーション → シードを適用する。
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

export async function openDatabase({ dataDir, seed = true, log = console.log } = {}) {
  const fresh = !dataDir || !existsSync(join(dataDir, 'PG_VERSION'));
  const db = new PGlite({ ...(dataDir ? { dataDir } : {}), extensions: { btree_gist, pgcrypto } });
  await db.waitReady;
  if (fresh) {
    log('[db] applying Supabase shim');
    await db.exec(readFileSync(join(root, 'dev-server', 'shim.sql'), 'utf8'));
    await db.exec('create table public._dev_migrations (name text primary key, applied_at timestamptz default now())');
    await db.exec('revoke all on public._dev_migrations from anon, authenticated');
  }
  const applied = new Set((await db.query('select name from public._dev_migrations')).rows.map((r) => r.name));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    log(`[db] migration ${file}`);
    await db.exec(`set search_path = public, extensions;\n${readFileSync(join(migrationsDir, file), 'utf8')}\nreset search_path;`);
    await db.query('insert into public._dev_migrations (name) values ($1)', [file]);
  }
  if (fresh && seed) {
    log('[db] seeding demo data');
    await db.exec(`set search_path = public, extensions;\n${readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8')}\nreset search_path;`);
  }
  return db;
}

// PostgREST と同じく、ロールと JWT クレームをトランザクション内に設定して実行する
export async function asRole(db, claims, fn) {
  return db.transaction(async (tx) => {
    const role = claims?.role === 'authenticated' ? 'authenticated' : claims?.role === 'service_role' ? 'service_role' : 'anon';
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims ?? { role: 'anon' })]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}
