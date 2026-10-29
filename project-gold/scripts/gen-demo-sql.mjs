// ブラウザ完結デモ用に、シム・マイグレーション・シード・デモ画像を TypeScript モジュールへ書き出す。
// 出力: src/demo/sql.generated.ts（手で編集しない。npm run build:demo が毎回再生成する）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
// ブラウザ版では PostgreSQL 拡張（btree_gist / pgcrypto）を読み込まない。
// 配信先によって拡張ファイルが壊れて届くため、代わりに下の DEMO_EXT_SHIM の関数を使う。
// 二重予約の防止は RPC 内のアドバイザリロック＋重複チェックで行われる（排他制約は本番 DB のみ）。
const stripForBrowser = (sql) => {
  const out = sql
    .replace(/^create extension if not exists (btree_gist|pgcrypto) with schema extensions;$/gm, '-- (browser demo) extension skipped')
    .replace(/^alter table public\.bookings add constraint no_double_booking_(woman|man)\n  exclude using gist [^\n]*;$/gm, '-- (browser demo) exclusion constraint skipped');
  return out;
};
const migrations = readdirSync(new URL('supabase/migrations/', root)).filter((f) => f.endsWith('.sql')).sort()
  .map((name) => ({ name, sql: stripForBrowser(read(`supabase/migrations/${name}`)) }));
const first = migrations[0].sql;
if (/create extension|exclude using gist/.test(first)) throw new Error('browser demo: failed to strip extensions from the first migration');

// pgcrypto の代替（デモ専用・端末内だけで使うため暗号強度は求めない）
const DEMO_EXT_SHIM = `
create schema if not exists extensions;
create or replace function extensions.gen_salt(text) returns text language sql volatile as
  $$ select 'demo$' || substr(md5(random()::text), 1, 8) $$;
create or replace function extensions.crypt(password text, salt text) returns text language sql immutable as
  $$ select substr(salt, 1, 13) || md5(substr(salt, 1, 13) || password) $$;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql volatile as
  $$ select decode(substr(md5(random()::text) || md5(random()::text) || md5(random()::text), 1, n * 2), 'hex') $$;
grant usage on schema extensions to anon, authenticated, service_role;
`;
const assets = readdirSync(new URL('supabase/seed-assets/demo/', root)).filter((f) => f.endsWith('.svg')).sort()
  .map((name) => ({ name, svg: read(`supabase/seed-assets/demo/${name}`) }));

const out = `// 自動生成ファイル（scripts/gen-demo-sql.mjs）。編集しないこと。
export const SHIM = ${JSON.stringify(read('dev-server/shim.sql') + DEMO_EXT_SHIM)};
export const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(migrations)};
export const SEED = ${JSON.stringify(read('supabase/seed.sql'))};
export const DEMO_ASSETS: { name: string; svg: string }[] = ${JSON.stringify(assets)};
`;
writeFileSync(new URL('src/demo/sql.generated.ts', root), out);
console.log(`wrote src/demo/sql.generated.ts (${migrations.length} migrations, ${assets.length} assets, ${(out.length / 1024).toFixed(0)} KB)`);
