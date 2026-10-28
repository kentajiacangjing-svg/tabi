// 決済 Webhook の受け口（雛形）。
// 方針: 課金状態は「署名を検証した決済事業者/ストアのイベント」でのみ更新し、クライアントの申告は信用しない。
// 現状: 承認済みの決済事業者が未確定のため、署名検証の枠組みのみを実装し、イベントの反映は行わない（501を返す）。
//   - サブスク（デジタル会員機能）: App Store / Google Play のアプリ内課金（RevenueCat 等の Webhook）を想定
//   - 対面の予約サービス: ストア規約・決済代行の審査に従い、別の決済事業者で処理する想定
// 有効化の手順は docs/handoff.md の「決済の本番化」を参照。
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';
const PROVIDER = Deno.env.get('PAYMENT_PROVIDER') ?? ''; // 例: 'revenuecat' | 'stripe'（未設定なら無効）

async function verify(req: Request, body: string): Promise<boolean> {
  if (!SECRET) return false;
  const sig = req.headers.get('x-webhook-signature') ?? '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === sig; // 本番では事業者 SDK の署名検証（タイミング安全な比較）を使うこと
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  if (!PROVIDER) return new Response(JSON.stringify({ error: 'payment provider not configured' }), { status: 501 });
  if (!(await verify(req, body))) return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // TODO(本番化): 事業者のイベント種別ごとに payments / membership_entitlements / refunds を更新し、
  //   public.recompute_man(user) を呼ぶ。冪等性のため provider_ref で重複を除外する。
  await admin.from('audit_events').insert({ action: 'payment.webhook_received', target_type: 'provider', target_id: PROVIDER, detail: { size: body.length } });
  return new Response(JSON.stringify({ received: true, applied: false }), { status: 202 });
});
