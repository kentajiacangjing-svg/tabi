// Supabase（ローカル `supabase start` または開発用プロジェクト）にデモ画像をアップロードする。
// 使い方: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-storage.mjs
// ※ service_role キーはサーバー専用。アプリ（EXPO_PUBLIC_*）やリポジトリに含めないこと。
import { readdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数で指定してください');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const dir = new URL('../supabase/seed-assets/demo/', import.meta.url);
for (const f of readdirSync(dir)) {
  const { error } = await sb.storage.from('profile-photos').upload(`demo/${f}`, readFileSync(new URL(f, dir)), { contentType: 'image/svg+xml', upsert: true });
  console.log(error ? `✘ ${f}: ${error.message}` : `✔ demo/${f}`);
}
