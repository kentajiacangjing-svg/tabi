// ブラウザ完結デモ用に、シム・マイグレーション・シード・デモ画像を TypeScript モジュールへ書き出す。
// 出力: src/demo/sql.generated.ts（手で編集しない。npm run build:demo が毎回再生成する）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const migrations = readdirSync(new URL('supabase/migrations/', root)).filter((f) => f.endsWith('.sql')).sort()
  .map((name) => ({ name, sql: read(`supabase/migrations/${name}`) }));
const assets = readdirSync(new URL('supabase/seed-assets/demo/', root)).filter((f) => f.endsWith('.svg')).sort()
  .map((name) => ({ name, svg: read(`supabase/seed-assets/demo/${name}`) }));

const out = `// 自動生成ファイル（scripts/gen-demo-sql.mjs）。編集しないこと。
export const SHIM = ${JSON.stringify(read('dev-server/shim.sql'))};
export const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(migrations)};
export const SEED = ${JSON.stringify(read('supabase/seed.sql'))};
export const DEMO_ASSETS: { name: string; svg: string }[] = ${JSON.stringify(assets)};
`;
writeFileSync(new URL('src/demo/sql.generated.ts', root), out);
console.log(`wrote src/demo/sql.generated.ts (${migrations.length} migrations, ${assets.length} assets, ${(out.length / 1024).toFixed(0)} KB)`);
