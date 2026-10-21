// Limited-test access gate (no database, safe for the middleware runtime).
//
// SITE_BASIC_AUTH="user:password" puts the whole site behind the browser's sign-in box, so only people who were
// given the password can open it during a limited test. API routes are excluded: they check the session (or
// CRON_SECRET) themselves, and /api/health must stay reachable for the uptime monitor.
// While the gate is on — or with ROBOTS_NOINDEX=true — responses carry X-Robots-Tag: noindex.

/** Compare without stopping at the first different character. */
function sameString(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** null = no gate configured. Otherwise whether the Authorization header carries the configured credentials. */
export function siteGateAllows(authorization: string | null, configured = process.env.SITE_BASIC_AUTH): boolean | null {
  if (!configured || !configured.includes(":")) return null;
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return false;
  }
  return sameString(decoded, configured);
}

export const noIndex = () => !!process.env.SITE_BASIC_AUTH || process.env.ROBOTS_NOINDEX === "true";
