// Attempt limits stored in the database, so they hold across server processes and restarts.
// Fixed windows: at most `limit` hits per `windowSec` for one key (e.g. "login:email:a@b.c", "login:ip:1.2.3.4").
import { get, now, run, tx } from "./db";
import { DomainError } from "./errors";

export const RATE_LIMIT_MESSAGE = "操作の回数が多すぎます。しばらく時間をおいてから、もう一度お試しください。";

/** Counts one attempt. Throws when the key is over its limit (the attempt is still counted). */
export function hitRateLimit(key: string, limit: number, windowSec: number) {
  const ts = now();
  const over = tx(() => {
    const row = get<{ count: number; window_end: string }>("SELECT count, window_end FROM rate_limits WHERE key = ?", key);
    if (!row || row.window_end < ts) {
      const end = new Date(Date.now() + windowSec * 1000).toISOString();
      run("INSERT INTO rate_limits (key, count, window_end) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET count = 1, window_end = excluded.window_end", key, end);
      return false;
    }
    run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
    return row.count + 1 > limit;
  });
  if (over) throw new DomainError(RATE_LIMIT_MESSAGE);
}

/** Forget the attempts for a key (e.g. after a successful sign-in). */
export function clearRateLimit(key: string) {
  run("DELETE FROM rate_limits WHERE key = ?", key);
}

/**
 * The client address for per-origin limits.
 *
 * Proxies append the address they received the request from to X-Forwarded-For, so the trustworthy entries are
 * the last ones; everything to the left can be written by the client. With TRUST_PROXY_HOPS = n (default 1:
 * one reverse proxy / load balancer in front of the app), the client is the n-th entry from the right.
 * TRUST_PROXY_HOPS=0 ignores the header (the app is reached directly). Per-account limits do not depend on this.
 */
export function clientIp(headers: Headers, hops = Number(process.env.TRUST_PROXY_HOPS ?? "1")): string {
  const n = Number.isFinite(hops) && hops >= 0 ? Math.floor(hops) : 1;
  if (n === 0) return "direct";
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = chain.length >= n ? chain[chain.length - n] : (headers.get("x-real-ip") ?? chain[0] ?? "unknown");
  return ip.slice(0, 64);
}
