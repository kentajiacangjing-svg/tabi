// ローカル開発サーバー用の .env.local を生成する（開発専用の鍵。本番の鍵はここに書かない）
import { writeFileSync, existsSync } from 'node:fs';
import { signJwt } from '../dev-server/server.mjs';

const secret = process.env.DEV_JWT_SECRET || 'dev-only-secret-change-me-0123456789abcdef';
const anon = signJwt({ role: 'anon', iss: 'project-gold-dev', iat: 1700000000, exp: 4102444800 }, secret);
const file = new URL('../.env.local', import.meta.url);
if (existsSync(file) && !process.argv.includes('--force')) {
  console.log('.env.local already exists (use --force to overwrite)');
} else {
  writeFileSync(file, `# 自動生成: ローカル開発サーバー接続用\nEXPO_PUBLIC_SUPABASE_URL=http://localhost:54321\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}\nEXPO_PUBLIC_REALTIME=off\n`);
  console.log('wrote .env.local');
}
