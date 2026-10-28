// PROJECT GOLD ローカル開発サーバー（Supabase 互換のサブセット）
//   /auth/v1/*     … GoTrue 互換: signup / token(password, refresh_token) / user / logout / recover
//   /rest/v1/rpc/* … PostgREST 互換: RPC 実行（JWT のロールとクレームを設定し RLS・権限をそのまま適用）
//   /rest/v1/:table… PostgREST 互換の最小実装（select / insert / update / delete, eq フィルタのみ）— RLS 検証用
//   /storage/v1/*  … Storage 互換: upload / sign / 署名URL配信 / remove（storage.objects の RLS で判定）
// 本番では Supabase をそのまま使う。このサーバーはデモ・自動テスト用で、インターネットへ公開しないこと。
import http from 'node:http';
import crypto from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, asRole } from './db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const sig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts[2]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.heic': 'image/heic' };

export async function createDevServer({
  port = Number(process.env.DEV_API_PORT || 54321),
  dataDir = process.env.DEV_DATA_DIR ?? join(here, '.data', 'pg'),
  storageDir = process.env.DEV_STORAGE_DIR ?? join(here, '.data', 'storage'),
  jwtSecret = process.env.DEV_JWT_SECRET || 'dev-only-secret-change-me-0123456789abcdef',
  siteUrl = process.env.DEV_SITE_URL || 'http://localhost:8081',
  memory = false,
  log = console.log,
} = {}) {
  const db = await openDatabase({ dataDir: memory ? undefined : dataDir, log });
  const store = memory ? join(here, '.data', `storage-mem-${process.pid}-${Date.now()}`) : storageDir;
  mkdirSync(store, { recursive: true });
  const mailbox = [];

  // デモ画像を Storage に配置（storage.objects にも登録）
  const demoDir = join(root, 'supabase', 'seed-assets', 'demo');
  if (existsSync(demoDir)) {
    mkdirSync(join(store, 'profile-photos', 'demo'), { recursive: true });
    for (const f of readdirSync(demoDir)) {
      writeFileSync(join(store, 'profile-photos', 'demo', f), readFileSync(join(demoDir, f)));
      await db.query(
        `insert into storage.objects (bucket_id, name, metadata) values ('profile-photos', $1, $2) on conflict do nothing`,
        [`demo/${f}`, JSON.stringify({ mimetype: MIME[extname(f)] || 'application/octet-stream' })]
      );
    }
  }

  const anonKey = signJwt({ role: 'anon', iss: 'project-gold-dev', iat: 1700000000, exp: 4102444800 }, jwtSecret);
  const serviceKey = signJwt({ role: 'service_role', iss: 'project-gold-dev', iat: 1700000000, exp: 4102444800 }, jwtSecret);

  const userJson = (u) => ({
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.email_confirmed_at, confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.raw_app_meta_data || {}, user_metadata: u.raw_user_meta_data || {}, identities: [],
    created_at: u.created_at, updated_at: u.updated_at,
  });

  async function issueSession(u) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const access = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + expiresIn,
      user_metadata: u.raw_user_meta_data || {}, app_metadata: u.raw_app_meta_data || {}, session_id: crypto.randomUUID() }, jwtSecret);
    const refresh = crypto.randomBytes(24).toString('hex');
    await db.query('insert into auth.dev_refresh_tokens (token, user_id) values ($1, $2)', [refresh, u.id]);
    await db.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]);
    return { access_token: access, token_type: 'bearer', expires_in: expiresIn, expires_at: now + expiresIn, refresh_token: refresh, user: userJson(u) };
  }

  const getUser = async (id) => (await db.query('select * from auth.users where id = $1', [id])).rows[0];

  function claimsFrom(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers.apikey;
    const c = verifyJwt(token, jwtSecret);
    return c || { role: 'anon' };
  }

  function send(res, status, body, headers = {}) {
    const isBuf = Buffer.isBuffer(body);
    res.writeHead(status, { 'content-type': isBuf ? 'application/octet-stream' : 'application/json', ...headers });
    res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body));
  }

  function pgError(res, e) {
    const code = e.code || 'XX000';
    const status = code === '42501' ? 403 : code === 'P0001' || code.startsWith('22') || code.startsWith('23') ? 400 : code === '42883' ? 404 : 500;
    if (status === 500) log('[pg error]', e.message);
    send(res, status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
  }

  async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return Buffer.concat(chunks);
  }

  const fnCache = new Map();
  async function functionSignature(name) {
    if (fnCache.has(name)) return fnCache.get(name);
    const r = await db.query(
      `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types, p.pronargs as n
       from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = $1`, [name]);
    const sig = r.rows[0] || null;
    fnCache.set(name, sig);
    return sig;
  }

  const ident = (s) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('invalid identifier'), { code: '42602' });
    return `"${s}"`;
  };

  function parseFilters(url) {
    const where = [];
    const params = [];
    for (const [k, v] of url.searchParams) {
      if (['select', 'limit', 'order', 'offset'].includes(k)) continue;
      if (!v.startsWith('eq.')) throw Object.assign(new Error('only eq filters are supported in dev server'), { code: '42601' });
      params.push(v.slice(3));
      where.push(`${ident(k)}::text = $${params.length}`);
    }
    return { where: where.length ? `where ${where.join(' and ')}` : '', params };
  }

  async function handle(req, res) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const p = url.pathname;
    res.setHeader('access-control-allow-origin', req.headers.origin || '*');
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-expose-headers', 'content-range, x-supabase-api-version');
    if (req.method === 'OPTIONS') return send(res, 204);

    // ------------------------------------------------------------ auth
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password, data } = JSON.parse((await readBody(req)).toString() || '{}');
      const mail = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return send(res, 400, { code: 'validation_failed', msg: 'メールアドレスの形式が正しくありません' });
      if (String(password || '').length < 8) return send(res, 422, { code: 'weak_password', msg: 'パスワードは8文字以上にしてください', weak_password: { reasons: ['length'], message: 'too short' } });
      const exists = await db.query('select 1 from auth.users where lower(email) = $1', [mail]);
      if (exists.rows.length) return send(res, 422, { code: 'user_already_exists', msg: 'このメールアドレスは既に登録されています' });
      const meta = { role: data?.role, display_name: data?.display_name };
      try {
        const r = await db.query(
          `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
           values ($1, extensions.crypt($2, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', $3) returning *`,
          [mail, password, JSON.stringify(meta)]);
        return send(res, 200, await issueSession(r.rows[0]));
      } catch (e) {
        return send(res, 400, { code: 'unexpected_failure', msg: '登録に失敗しました（役割の指定が不正です）' });
      }
    }

    if (p === '/auth/v1/token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (grant === 'password') {
        const r = await db.query(
          `select * from auth.users where lower(email) = lower($1) and encrypted_password <> ''
             and encrypted_password = extensions.crypt($2, encrypted_password)`, [body.email || '', body.password || '']);
        if (!r.rows[0]) return send(res, 400, { error: 'invalid_grant', code: 'invalid_credentials', error_description: 'メールアドレスまたはパスワードが正しくありません' });
        return send(res, 200, await issueSession(r.rows[0]));
      }
      if (grant === 'refresh_token') {
        const r = await db.query('update auth.dev_refresh_tokens set revoked = true where token = $1 and not revoked returning user_id', [body.refresh_token || '']);
        if (!r.rows[0]) return send(res, 400, { error: 'invalid_grant', code: 'refresh_token_not_found', error_description: 'Invalid Refresh Token' });
        return send(res, 200, await issueSession(await getUser(r.rows[0].user_id)));
      }
      return send(res, 400, { error: 'unsupported_grant_type', error_description: 'unsupported grant type' });
    }

    if (p === '/auth/v1/user') {
      const c = claimsFrom(req);
      if (c.role !== 'authenticated') return send(res, 401, { code: 'no_authorization', msg: 'ログインが必要です' });
      const u = await getUser(c.sub);
      if (!u || !u.encrypted_password) return send(res, 403, { code: 'user_not_found', msg: 'User not found' });
      if (req.method === 'PUT') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        if (body.password !== undefined) {
          if (String(body.password).length < 8) return send(res, 422, { code: 'weak_password', msg: 'パスワードは8文字以上にしてください' });
          await db.query(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`, [u.id, body.password]);
        }
        return send(res, 200, userJson(await getUser(u.id)));
      }
      return send(res, 200, userJson(u));
    }

    if (p === '/auth/v1/logout' && req.method === 'POST') {
      const c = claimsFrom(req);
      if (c.sub) await db.query('update auth.dev_refresh_tokens set revoked = true where user_id = $1', [c.sub]);
      return send(res, 204);
    }

    if (p === '/auth/v1/recover' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const r = await db.query('select * from auth.users where lower(email) = lower($1)', [body.email || '']);
      if (r.rows[0]) {
        const s = await issueSession(r.rows[0]);
        const redirect = url.searchParams.get('redirect_to') || `${siteUrl}/reset-password`;
        const link = `${redirect}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=${s.expires_in}&expires_at=${s.expires_at}&token_type=bearer&type=recovery`;
        mailbox.push({ to: r.rows[0].email, subject: 'パスワード再設定', link, at: new Date().toISOString() });
        log(`[mail] password reset for ${r.rows[0].email}: ${link}`);
      }
      return send(res, 200, {}); // 登録有無を推測されないよう常に成功
    }

    if (p === '/dev/mailbox') return send(res, 200, mailbox.slice(-20));
    if (p === '/dev/keys') return send(res, 200, { anonKey, url: `http://localhost:${port}` });

    // ------------------------------------------------------------ rest
    if (p.startsWith('/rest/v1/rpc/') && (req.method === 'POST' || req.method === 'GET')) {
      const name = p.slice('/rest/v1/rpc/'.length);
      const args = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : Object.fromEntries(url.searchParams);
      const sig = /^[a-z_][a-z0-9_]*$/.test(name) ? await functionSignature(name) : null;
      if (!sig) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${name}`, details: null, hint: null });
      const names = sig.names || [];
      for (const k of Object.keys(args)) if (!names.includes(k)) return send(res, 404, { code: 'PGRST202', message: `Unknown argument ${k} for ${name}`, details: null, hint: null });
      const parts = [];
      const values = [];
      names.forEach((n, i) => {
        if (n in args) {
          const v = args[n];
          const ty = sig.types[i];
          values.push(v === null ? null : ty === 'jsonb' || ty === 'json' ? JSON.stringify(v) : ty.endsWith('[]') ? toPgArray(v) : typeof v === 'object' ? JSON.stringify(v) : v);
          parts.push(`${ident(n)} => $${values.length}::${sig.types[i]}`);
        }
      });
      try {
        const r = await asRole(db, claimsFrom(req), (tx) => tx.query(`select public.${ident(name)}(${parts.join(', ')}) as r`, values));
        return send(res, 200, r.rows[0]?.r ?? null);
      } catch (e) {
        return pgError(res, e);
      }
    }

    if (p.startsWith('/rest/v1/') && !p.startsWith('/rest/v1/rpc/')) {
      const table = p.slice('/rest/v1/'.length);
      try {
        const t = `public.${ident(table)}`;
        const { where, params } = parseFilters(url);
        const claims = claimsFrom(req);
        let rows;
        if (req.method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 1000);
          rows = (await asRole(db, claims, (tx) => tx.query(`select * from ${t} ${where} limit ${limit}`, params))).rows;
        } else if (req.method === 'POST') {
          const body = JSON.parse((await readBody(req)).toString() || '{}');
          const cols = Object.keys(body);
          const vals = cols.map((c) => (typeof body[c] === 'object' && body[c] !== null ? JSON.stringify(body[c]) : body[c]));
          rows = (await asRole(db, claims, (tx) => tx.query(
            `insert into ${t} (${cols.map(ident).join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning *`, vals))).rows;
        } else if (req.method === 'PATCH') {
          const body = JSON.parse((await readBody(req)).toString() || '{}');
          const cols = Object.keys(body);
          const sets = cols.map((c, i) => `${ident(c)} = $${params.length + i + 1}`);
          rows = (await asRole(db, claims, (tx) => tx.query(`update ${t} set ${sets.join(',')} ${where} returning *`, [...params, ...cols.map((c) => body[c])]))).rows;
        } else if (req.method === 'DELETE') {
          rows = (await asRole(db, claims, (tx) => tx.query(`delete from ${t} ${where} returning *`, params))).rows;
        } else return send(res, 405, { message: 'method not allowed' });
        return send(res, req.method === 'POST' ? 201 : 200, rows);
      } catch (e) {
        return pgError(res, e);
      }
    }

    // ------------------------------------------------------------ storage
    if (p.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      const bucket = decodeURIComponent(p.slice('/storage/v1/object/sign/'.length));
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const paths = body.paths || [];
      const claims = claimsFrom(req);
      try {
        const out = await asRole(db, claims, async (tx) => {
          const list = [];
          for (const path of paths) {
            const ok = (await tx.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, path])).rows.length > 0;
            if (!ok) list.push({ path, error: 'Either the object does not exist or you do not have access to it', signedURL: null });
            else {
              const token = signJwt({ url: `${bucket}/${path}`, exp: Math.floor(Date.now() / 1000) + Number(body.expiresIn || 60) }, jwtSecret);
              list.push({ path, error: null, signedURL: `/object/sign/${bucket}/${path}?token=${token}` });
            }
          }
          return list;
        });
        return send(res, 200, out);
      } catch (e) {
        return pgError(res, e);
      }
    }

    if (p.startsWith('/storage/v1/object/sign/') && req.method === 'GET') {
      const rest = decodeURIComponent(p.slice('/storage/v1/object/sign/'.length));
      const t = verifyJwt(url.searchParams.get('token'), jwtSecret);
      if (!t || t.url !== rest) return send(res, 400, { statusCode: '400', error: 'InvalidJWT', message: 'invalid signature' });
      const file = normalize(join(store, rest));
      if (!file.startsWith(store) || !existsSync(file)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'private, max-age=600' });
      return res.end(readFileSync(file));
    }

    if (p.startsWith('/storage/v1/object/') && (req.method === 'POST' || req.method === 'PUT')) {
      const rest = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      const [bucket, ...segs] = rest.split('/');
      const name = segs.join('/');
      if (!name || name.includes('..')) return send(res, 400, { statusCode: '400', error: 'InvalidKey', message: 'invalid key' });
      const body = await readBody(req);
      if (body.length > 5 * 1024 * 1024) return send(res, 413, { statusCode: '413', error: 'Payload too large', message: '画像は5MB以下にしてください' });
      const contentType = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0];
      if (!/^image\/(jpeg|png|webp|heic|svg\+xml)$/.test(contentType)) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: '対応していないファイル形式です' });
      const claims = claimsFrom(req);
      try {
        const id = await asRole(db, claims, async (tx) => (await tx.query(
          `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
           on conflict (bucket_id, name) do update set metadata = excluded.metadata returning id`,
          [bucket, name, claims.sub || null, JSON.stringify({ mimetype: contentType, size: body.length })])).rows[0].id);
        const file = join(store, bucket, name);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, body);
        return send(res, 200, { Key: `${bucket}/${name}`, Id: id });
      } catch (e) {
        if (e.code === '42501') return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
        return pgError(res, e);
      }
    }

    if (p.startsWith('/storage/v1/object/') && req.method === 'DELETE') {
      const bucket = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const claims = claimsFrom(req);
      try {
        const removed = await asRole(db, claims, async (tx) => (await tx.query(
          'delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name', [bucket, toPgArray(body.prefixes || [])])).rows);
        for (const r of removed) rmSync(join(store, bucket, r.name), { force: true });
        return send(res, 200, removed.map((r) => ({ name: r.name })));
      } catch (e) {
        return pgError(res, e);
      }
    }

    if (p === '/' || p === '/health') return send(res, 200, { ok: true, service: 'project-gold-dev-server', anonKey });
    return send(res, 404, { message: 'not found' });
  }

  function toPgArray(v) {
    const arr = Array.isArray(v) ? v : [];
    return `{${arr.map((x) => `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      log('[server error]', e);
      if (!res.headersSent) send(res, 500, { message: 'internal error' });
    });
  });
  await new Promise((resolve) => server.listen(port, resolve));
  const actualPort = server.address().port;
  return {
    url: `http://localhost:${actualPort}`, anonKey, serviceKey, db, mailbox,
    close: async () => {
      await new Promise((r) => server.close(r));
      await db.close();
      if (memory) rmSync(store, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  if (process.argv.includes('--reset')) rmSync(join(here, '.data'), { recursive: true, force: true });
  const s = await createDevServer({ memory: process.argv.includes('--memory') });
  console.log(`\nPROJECT GOLD dev server: ${s.url}`);
  console.log(`EXPO_PUBLIC_SUPABASE_URL=${s.url}`);
  console.log(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${s.anonKey}\n`);
  console.log('デモアカウント（パスワード DemoPass123!）: taro@ / kenichi@ / misaki@ / yui@ / admin@demo.projectgold.local');
}
