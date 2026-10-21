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
 * The client address as seen by the app. Behind a reverse proxy, the first X-Forwarded-For entry is the client
 * only if the proxy sets it — configure the proxy to overwrite, not append, the header.
 */
export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
