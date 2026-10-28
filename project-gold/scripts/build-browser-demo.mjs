// ブラウザ完結デモ（サーバー不要）を demo-dist/ に書き出す。
//  - アプリ本体: EXPO_PUBLIC_DEMO_BROWSER=on で Web 書き出し（分割読み込みなし）
//  - DB: PGlite（WASM 版 PostgreSQL）を同梱し、本番と同じマイグレーション・RLS をブラウザ内で実行
//  - どの URL 配下に置いても動くよう、JS は相対パスで読み込み、フォントは data URI で埋め込む
// 使い方: npm run build:demo   → demo-dist/index.html を静的ホスティングで開く
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'demo-dist');
const tmp = join(root, 'dist-demo-build');

execSync('node scripts/gen-demo-sql.mjs', { cwd: root, stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
execSync(`npx expo export -p web --output-dir ${tmp} --clear`, {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, DEMO_BUILD: '1', EXPO_PUBLIC_DEMO_BROWSER: 'on', EXPO_PUBLIC_REALTIME: 'off', EXPO_OFFLINE: '1' },
});

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// ---- JS（相対パス化・フォント埋め込み）
const jsDir = join(tmp, '_expo/static/js/web');
const html = readFileSync(join(tmp, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="\/(_expo\/static\/js\/web\/[^"]+)"/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('script tags not found in exported index.html');
const extra = readdirSync(jsDir).filter((f) => !scripts.some((s) => s.endsWith(f)));
if (extra.length) throw new Error(`unexpected split chunks (asyncRoutes が無効になっていません): ${extra.join(', ')}`);
mkdirSync(join(out, 'app'), { recursive: true }); // 先頭が _ のパスは配布先で予約されているため app/ に置く
const used = ['CormorantGaramond_500Medium', 'CormorantGaramond_600SemiBold'];
for (const s of scripts) {
  let js = readFileSync(join(tmp, s), 'utf8');
  js = js.replace(/"\/(assets\/[^"]+\.ttf)"/g, (m, p) => {
    if (!used.some((u) => p.includes(`/${u}.`))) return m;
    return JSON.stringify(`data:font/ttf;base64,${readFileSync(join(tmp, p)).toString('base64')}`);
  });
  writeFileSync(join(out, 'app', s.split('/').pop()), js);
}

// ---- PGlite（配布できるファイル形式に名前を変えて同梱）
const pg = join(root, 'node_modules/@electric-sql/pglite/dist');
mkdirSync(join(out, 'pglite/contrib'), { recursive: true });
for (const f of readdirSync(pg)) if (f.endsWith('.js')) copyFileSync(join(pg, f), join(out, 'pglite', f));
copyFileSync(join(pg, 'pglite.wasm'), join(out, 'pglite/pglite.wasm'));
copyFileSync(join(pg, 'initdb.wasm'), join(out, 'pglite/initdb.wasm'));
copyFileSync(join(pg, 'pglite.data'), join(out, 'pglite/pglite-data.wasm'));
copyFileSync(join(pg, 'btree_gist.tar.gz'), join(out, 'pglite/btree_gist-ext.wasm'));
copyFileSync(join(pg, 'pgcrypto.tar.gz'), join(out, 'pglite/pgcrypto-ext.wasm'));

// ---- ページ本体
const resetCss = html.match(/<style id="expo-reset">([\s\S]*?)<\/style>/)?.[1] ?? '';
const page = `<title>PROJECT GOLD</title>
<meta name="theme-color" content="#FAF9F6">
<style>${resetCss}
html, body { background: #FAF9F6; }
</style>
<div id="root"></div>
<script>window.__DEMO_BASE = document.baseURI;</script>
<script type="module">
// 1) DB（PGlite）の読み込みを開始し、アプリから使えるようにする
const base = new URL('./pglite/', window.__DEMO_BASE);
window.__PG = (async () => {
  const [{ PGlite }, wasm, data] = await Promise.all([
    import(new URL('index.js', base).href),
    WebAssembly.compileStreaming(fetch(new URL('pglite.wasm', base))),
    fetch(new URL('pglite-data.wasm', base)).then((r) => r.blob()),
  ]);
  const ext = (name) => ({ name, setup: async () => ({ bundlePath: new URL(name + '-ext.wasm', base) }) });
  return { PGlite, wasm, data, ext };
})();
// 2) アプリの画面遷移はルート（/）から始める
try { history.replaceState(null, '', '/'); } catch (e) {}
</script>
${scripts.map((s) => `<script src="./app/${s.split('/').pop()}" defer></script>`).join('\n')}
`;
writeFileSync(join(out, 'index.html'), page);
rmSync(tmp, { recursive: true, force: true });

const size = (d) => readdirSync(d).reduce((n, f) => { const p = join(d, f); return n + (statSync(p).isDirectory() ? size(p) : statSync(p).size); }, 0);
console.log(`demo-dist ready: ${(size(out) / 1048576).toFixed(1)} MB, scripts: ${scripts.length}`);
if (!existsSync(join(out, 'index.html'))) process.exit(1);
