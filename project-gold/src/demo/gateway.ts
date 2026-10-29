/**
 * ブラウザ完結デモ用ゲートウェイ（EXPO_PUBLIC_DEMO_BROWSER=on のときだけ使用）。
 * dev-server/server.mjs と同じ考え方で、Supabase の Auth / RPC / Storage のうちアプリが使う部分を、
 * ブラウザ内の PGlite（WASM 版 PostgreSQL）＋本番と同じマイグレーション・RLS で処理する。
 * データはこの端末のブラウザ（IndexedDB）にだけ保存される。トークンはデモ用で署名検証を行わない
 * （DB そのものが利用者の端末にあるため、ここでの認証はアプリの動作確認のためのもの）。
 */
import { DEMO_ASSETS, MIGRATIONS, SEED, SHIM } from './sql.generated';

type Row = Record<string, unknown>;
type Tx = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>; exec: (sql: string) => Promise<unknown> };
type DB = Tx & { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> };
type Loader = { PGlite: new (opts: object) => DB & { waitReady: Promise<void> }; wasm: WebAssembly.Module; data: Blob; ext: (name: string) => object };

declare global {
  interface Window {
    __PG?: Promise<Loader>;
  }
}

export const DEMO_URL = 'https://demo.invalid';
const IDB_NAME = 'project-gold-demo';
let ready: Promise<DB> | null = null;

/** 起動状況（画面に表示する） */
export type DemoStatus = { phase: 'loading' | 'ready' | 'error'; step: string; message?: string; persistent?: boolean };
let status: DemoStatus = { phase: 'loading', step: '読み込み中' };
const listeners = new Set<(s: DemoStatus) => void>();
function setStatus(s: Partial<DemoStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l(status));
}
export const getDemoStatus = () => status;
export function subscribeDemoStatus(fn: (s: DemoStatus) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what}がタイムアウトしました`)), ms))]);
const mailbox: { to: string; link: string }[] = [];

function b64url(s: string) {
  return btoa(unescape(encodeURIComponent(s))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function unb64url(s: string) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(t + '='.repeat((4 - (t.length % 4)) % 4))));
}
const token = (payload: object) => `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.demo`;
function readToken(t: string | null | undefined): Row | null {
  try {
    const p = JSON.parse(unb64url(String(t).split('.')[1]));
    if (p.exp && p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}
const rand = (n = 24) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

type PG = DB & { waitReady: Promise<void>; close?: () => Promise<void> };

function deleteIdb() {
  return new Promise((r) => {
    try {
      const q = indexedDB.deleteDatabase(`/pglite/${IDB_NAME}`);
      q.onsuccess = q.onerror = q.onblocked = () => r(null);
    } catch {
      r(null);
    }
  });
}

/** スキーマとデモデータを用意する。途中で止まった前回の状態（完了印なし）は作り直す */
async function prepare(db: PG) {
  const done = (await db.query(`select to_regclass('public._demo_done') is not null as ok`)).rows[0]?.ok;
  if (done) {
    // 既存データ: 追加されたマイグレーションだけ適用
    const applied = new Set((await db.query('select name from public._dev_migrations')).rows.map((r) => r.name as string));
    for (const m of MIGRATIONS) {
      if (applied.has(m.name)) continue;
      await db.exec(`set search_path = public, extensions;\n${m.sql}\nreset search_path;`);
      await db.query('insert into public._dev_migrations (name) values ($1)', [m.name]);
    }
    return;
  }
  if ((await db.query(`select to_regclass('public._dev_migrations') is not null as ok`)).rows[0]?.ok) {
    throw Object.assign(new Error('前回の準備が途中で止まっていました'), { incomplete: true });
  }
  setStatus({ step: 'デモデータを作成中（初回のみ）' });
  await db.exec(SHIM);
  await db.exec('create table public._dev_migrations (name text primary key); revoke all on public._dev_migrations from anon, authenticated;');
  await db.exec('create table public._demo_blobs (bucket text, name text, mime text, data text, primary key (bucket, name)); revoke all on public._demo_blobs from anon, authenticated;');
  for (const m of MIGRATIONS) {
    await db.exec(`set search_path = public, extensions;\n${m.sql}\nreset search_path;`);
    await db.query('insert into public._dev_migrations (name) values ($1)', [m.name]);
  }
  await db.exec(`set search_path = public, extensions;\n${SEED}\nreset search_path;`);
  for (const a of DEMO_ASSETS) {
    await db.query(`insert into storage.objects (bucket_id, name, metadata) values ('profile-photos', $1, '{"mimetype":"image/svg+xml"}') on conflict do nothing`, [`demo/${a.name}`]);
    await db.query(`insert into public._demo_blobs values ('profile-photos', $1, 'image/svg+xml', $2) on conflict do nothing`, [`demo/${a.name}`, btoa(unescape(encodeURIComponent(a.svg)))]);
  }
  await db.exec('create table public._demo_done (at timestamptz default now()); revoke all on public._demo_done from anon, authenticated;');
}

async function openDb(): Promise<DB> {
  if (!window.__PG) throw new Error('データベースの読み込み処理が見つかりません（ページを再読み込みしてください）');
  setStatus({ step: 'データベースを読み込み中（約17MB）' });
  const { PGlite, wasm, data, ext } = await withTimeout(window.__PG, 180000, 'データベースの読み込み');
  const opts = { wasmModule: wasm, fsBundle: data, extensions: { btree_gist: ext('btree_gist'), pgcrypto: ext('pgcrypto') } };
  let db: PG | null = null;
  // 1) 端末内保存（IndexedDB）で起動。前回の途中データ・保存不可・失敗のときは消してメモリ上で作り直す
  try {
    setStatus({ step: 'データベースを起動中' });
    db = new PGlite({ ...opts, dataDir: `idb://${IDB_NAME}` });
    await withTimeout(db.waitReady, 25000, '端末内への保存の準備');
    await prepare(db);
    setStatus({ persistent: true });
    return db;
  } catch (e) {
    console.warn('[demo] persistent database failed, falling back to memory:', e);
    try {
      await db?.close?.();
    } catch {}
    await deleteIdb();
  }
  setStatus({ step: 'データベースを起動中（一時保存モード）', persistent: false });
  const mem: PG = new PGlite(opts);
  await withTimeout(mem.waitReady, 60000, 'データベースの起動');
  await prepare(mem);
  return mem;
}

export function demoDb() {
  ready ??= openDb().then(
    (db) => {
      setStatus({ phase: 'ready', step: '準備完了' });
      return db;
    },
    (e) => {
      setStatus({ phase: 'error', message: `「${status.step}」の段階で止まりました：${String((e as Error)?.message ?? e)}` });
      ready = null; // 再試行できるようにする
      throw e;
    }
  );
  return ready;
}

// アプリを開いた時点で準備を始める（ログインを押すまで待たせない）
if (typeof window !== 'undefined') demoDb().catch(() => {});

/** デモデータを初期状態に戻す（IndexedDB を削除して再読み込み） */
export async function resetDemo() {
  try {
    localStorage.clear();
  } catch {}
  await new Promise((r) => {
    const q = indexedDB.deleteDatabase(`/pglite/${IDB_NAME}`);
    q.onsuccess = q.onerror = q.onblocked = () => r(null);
  });
  location.reload();
}

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function pgError(e: { code?: string; message?: string; detail?: string; hint?: string }) {
  const code = e.code || 'XX000';
  const status = code === '42501' ? 403 : code === 'P0001' || code.startsWith('22') || code.startsWith('23') ? 400 : code === '42883' ? 404 : 500;
  return json(status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

async function asRole<T>(db: DB, claims: Row, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    const role = claims.role === 'authenticated' ? 'authenticated' : 'anon';
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('invalid identifier'), { code: '42602' });
  return `"${s}"`;
};
const pgArray = (v: unknown) => `{${(Array.isArray(v) ? v : []).map((x) => `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
const fnCache = new Map<string, { names: string[] | null; types: string[] } | null>();

const userJson = (u: Row) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.email_confirmed_at, confirmed_at: u.email_confirmed_at,
  last_sign_in_at: u.last_sign_in_at, app_metadata: u.raw_app_meta_data || {}, user_metadata: u.raw_user_meta_data || {}, identities: [],
  created_at: u.created_at, updated_at: u.updated_at,
});

async function issueSession(db: DB, u: Row) {
  const now = Math.floor(Date.now() / 1000);
  const access = token({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: rand(8) });
  const refresh = rand();
  await db.query('insert into auth.dev_refresh_tokens (token, user_id) values ($1, $2)', [refresh, u.id]);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}

async function bodyBytes(init?: RequestInit): Promise<Uint8Array> {
  const b = init?.body;
  if (!b) return new Uint8Array();
  if (typeof b === 'string') return new TextEncoder().encode(b);
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (b instanceof Blob) return new Uint8Array(await b.arrayBuffer());
  return new TextEncoder().encode(String(b));
}
const toB64 = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};

/** supabase-js の global.fetch に渡す関数 */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const raw = await bodyBytes(init);
  const text = () => new TextDecoder().decode(raw);
  const body = () => JSON.parse(text() || '{}');
  const auth = headers.get('authorization') || '';
  const claims = readToken(auth.startsWith('Bearer ') ? auth.slice(7) : null) ?? { role: 'anon' };
  const p = url.pathname;
  let db: DB;
  try {
    db = await demoDb();
  } catch (e) {
    return json(503, { message: `デモ用データベースを起動できませんでした: ${(e as Error).message}` });
  }

  try {
    // ---------------------------------------------------------------- auth
    if (p === '/auth/v1/signup' && method === 'POST') {
      const { email, password, data } = body();
      const mail = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json(400, { code: 'validation_failed', msg: 'メールアドレスの形式が正しくありません' });
      if (String(password || '').length < 8) return json(422, { code: 'weak_password', msg: 'パスワードは8文字以上にしてください' });
      if ((await db.query('select 1 from auth.users where lower(email) = $1', [mail])).rows.length) return json(422, { code: 'user_already_exists', msg: 'このメールアドレスは既に登録されています' });
      try {
        const r = await db.query(
          `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
           values ($1, extensions.crypt($2, extensions.gen_salt('bf')), now(), '{"provider":"email"}', $3) returning *`,
          [mail, password, JSON.stringify({ role: data?.role, display_name: data?.display_name })]);
        return json(200, await issueSession(db, r.rows[0]));
      } catch {
        return json(400, { code: 'unexpected_failure', msg: '登録に失敗しました' });
      }
    }
    if (p === '/auth/v1/token' && method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      const b = body();
      if (grant === 'password') {
        const r = await db.query(`select * from auth.users where lower(email) = lower($1) and encrypted_password <> '' and encrypted_password = extensions.crypt($2, encrypted_password)`, [b.email || '', b.password || '']);
        if (!r.rows[0]) return json(400, { error: 'invalid_grant', code: 'invalid_credentials', error_description: 'メールアドレスまたはパスワードが正しくありません' });
        return json(200, await issueSession(db, r.rows[0]));
      }
      if (grant === 'refresh_token') {
        const r = await db.query('update auth.dev_refresh_tokens set revoked = true where token = $1 and not revoked returning user_id', [b.refresh_token || '']);
        if (!r.rows[0]) return json(400, { error: 'invalid_grant', code: 'refresh_token_not_found', error_description: 'Invalid Refresh Token' });
        const u = (await db.query('select * from auth.users where id = $1', [r.rows[0].user_id])).rows[0];
        return json(200, await issueSession(db, u));
      }
      return json(400, { error: 'unsupported_grant_type' });
    }
    if (p === '/auth/v1/user') {
      if (claims.role !== 'authenticated') return json(401, { code: 'no_authorization', msg: 'ログインが必要です' });
      const u = (await db.query('select * from auth.users where id = $1', [claims.sub])).rows[0];
      if (!u || !u.encrypted_password) return json(403, { code: 'user_not_found', msg: 'User not found' });
      if (method === 'PUT') {
        const b = body();
        if (b.password !== undefined) {
          if (String(b.password).length < 8) return json(422, { code: 'weak_password', msg: 'パスワードは8文字以上にしてください' });
          await db.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1`, [u.id, b.password]);
        }
        return json(200, userJson((await db.query('select * from auth.users where id = $1', [u.id])).rows[0]));
      }
      return json(200, userJson(u));
    }
    if (p === '/auth/v1/logout') {
      if (claims.sub) await db.query('update auth.dev_refresh_tokens set revoked = true where user_id = $1', [claims.sub]);
      return new Response(null, { status: 204 });
    }
    if (p === '/auth/v1/recover') {
      const r = await db.query('select * from auth.users where lower(email) = lower($1)', [body().email || '']);
      if (r.rows[0]) {
        const s = await issueSession(db, r.rows[0]);
        mailbox.push({ to: String(r.rows[0].email), link: `#access_token=${s.access_token}&refresh_token=${s.refresh_token}&type=recovery` });
      }
      return json(200, {});
    }

    // ---------------------------------------------------------------- rpc
    if (p.startsWith('/rest/v1/rpc/')) {
      const name = p.slice('/rest/v1/rpc/'.length);
      const args = method === 'POST' ? body() : Object.fromEntries(url.searchParams);
      if (!fnCache.has(name)) {
        const r = /^[a-z_][a-z0-9_]*$/.test(name)
          ? await db.query(`select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = $1`, [name])
          : { rows: [] };
        fnCache.set(name, (r.rows[0] as { names: string[] | null; types: string[] }) ?? null);
      }
      const sig = fnCache.get(name);
      if (!sig) return json(404, { code: 'PGRST202', message: `Could not find the function public.${name}` });
      const names = sig.names || [];
      const parts: string[] = [];
      const values: unknown[] = [];
      names.forEach((n, i) => {
        if (!(n in args)) return;
        const v = args[n];
        const ty = sig.types[i];
        values.push(v === null ? null : ty === 'jsonb' || ty === 'json' ? JSON.stringify(v) : ty.endsWith('[]') ? pgArray(v) : typeof v === 'object' ? JSON.stringify(v) : v);
        parts.push(`${ident(n)} => $${values.length}::${ty}`);
      });
      const r = await asRole(db, claims, (tx) => tx.query(`select public.${ident(name)}(${parts.join(', ')}) as r`, values));
      return json(200, r.rows[0]?.r ?? null);
    }

    // ---------------------------------------------------------------- storage
    if (p.startsWith('/storage/v1/object/sign/') && method === 'POST') {
      const bucket = decodeURIComponent(p.slice('/storage/v1/object/sign/'.length));
      const b = body();
      const out = await asRole(db, claims, async (tx) => {
        const list = [];
        for (const path of (b.paths || []) as string[]) {
          const ok = (await tx.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, path])).rows.length > 0;
          list.push(ok ? { path, error: null, signedURL: `/object/sign/${bucket}/${path}?token=${token({ url: `${bucket}/${path}`, exp: Date.now() / 1000 + Number(b.expiresIn || 60) })}` }
            : { path, error: 'not found', signedURL: null });
        }
        return list;
      });
      return json(200, out);
    }
    if (p.startsWith('/storage/v1/object/sign/') && method === 'GET') {
      const rest = decodeURIComponent(p.slice('/storage/v1/object/sign/'.length));
      const t = readToken(url.searchParams.get('token'));
      if (!t || t.url !== rest) return json(400, { message: 'invalid signature' });
      const [bucket, ...segs] = rest.split('/');
      const r = (await db.query('select mime, data from public._demo_blobs where bucket = $1 and name = $2', [bucket, segs.join('/')])).rows[0];
      if (!r) return json(404, { message: 'Object not found' });
      const bin = atob(String(r.data));
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Response(u8, { status: 200, headers: { 'content-type': String(r.mime) } });
    }
    if (p.startsWith('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) {
      const [bucket, ...segs] = decodeURIComponent(p.slice('/storage/v1/object/'.length)).split('/');
      const name = segs.join('/');
      const mime = (headers.get('content-type') || 'application/octet-stream').split(';')[0];
      if (!name || name.includes('..')) return json(400, { message: 'invalid key' });
      if (raw.length > 5 * 1024 * 1024) return json(413, { message: '画像は5MB以下にしてください' });
      if (!/^image\/(jpeg|png|webp|heic|svg\+xml)$/.test(mime)) return json(415, { message: '対応していないファイル形式です' });
      try {
        const id = await asRole(db, claims, async (tx) => (await tx.query(
          `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4) on conflict (bucket_id, name) do update set metadata = excluded.metadata returning id`,
          [bucket, name, claims.sub || null, JSON.stringify({ mimetype: mime })])).rows[0].id);
        await db.query('insert into public._demo_blobs values ($1, $2, $3, $4) on conflict (bucket, name) do update set data = excluded.data, mime = excluded.mime', [bucket, name, mime, toB64(raw)]);
        return json(200, { Key: `${bucket}/${name}`, Id: id });
      } catch (e) {
        if ((e as { code?: string }).code === '42501') return json(403, { message: 'new row violates row-level security policy' });
        throw e;
      }
    }
    return json(404, { message: 'not found' });
  } catch (e) {
    return pgError(e as { code?: string; message?: string });
  }
}
