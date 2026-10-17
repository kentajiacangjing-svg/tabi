/** What a client sees when a server action can't be reached (offline, timeout, deploy in progress). */
export const NETWORK_ERROR = { ok: false as const, error: "通信できませんでした。もう一度お試しください。" };

/** Turns a rejected server-action call into an ordinary `{ ok: false }` result, so a dropped connection
 * shows a short message instead of throwing out to the error page. */
export function soft<T>(call: Promise<T>): Promise<T | typeof NETWORK_ERROR> {
  return call.catch(() => NETWORK_ERROR);
}
