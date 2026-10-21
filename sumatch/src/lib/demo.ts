// Demo mode: sample companies, customers, reviews and photos, plus one-click demo login.
// Off in production unless DEMO_MODE=true is set explicitly, so sample data never looks like real data.
export function isDemo(): boolean {
  const v = process.env.DEMO_MODE;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * SQL condition that hides sample rows (is_demo = 1) outside demo mode. `a` is the table alias, e.g. "c.".
 * Used wherever companies or accounts reach a public screen, matching or login.
 */
export function demoVisibleSql(a = ""): string {
  return isDemo() ? "1 = 1" : `${a}is_demo = 0`;
}
