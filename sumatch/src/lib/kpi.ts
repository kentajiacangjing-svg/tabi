import { all, get } from "./db";

const n = (sql: string, ...p: string[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;

export function kpis(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const visits = n("SELECT COUNT(*) n FROM events WHERE kind = 'visit' AND created_at >= ?", since);
  const starts = n("SELECT COUNT(*) n FROM events WHERE kind = 'diagnosis_start' AND created_at >= ?", since);
  const completes = n("SELECT COUNT(*) n FROM events WHERE kind = 'diagnosis_complete' AND created_at >= ?", since);
  const requests = n("SELECT COUNT(*) n FROM matches WHERE customer_interest = 1 AND customer_interest_at >= ?", since);
  const matches = n("SELECT COUNT(*) n FROM matches WHERE matched_at >= ?", since);
  const quotes = n("SELECT COUNT(*) n FROM quotes WHERE version = 1 AND created_at >= ?", since);
  const contracts = n("SELECT COUNT(*) n FROM contracts WHERE created_at >= ?", since);
  const avgContract = get<{ a: number | null }>("SELECT AVG(amount) a FROM contracts WHERE created_at >= ?", since)?.a ?? null;
  const gmv = get<{ s: number | null }>("SELECT SUM(amount) s FROM contracts WHERE created_at >= ?", since)?.s ?? 0;
  const fee = get<{ s: number | null }>("SELECT SUM(amount * success_fee_rate) s FROM contracts WHERE created_at >= ?", since)?.s ?? 0;
  // Retention: approved companies older than 30 days that are still active (not suspended).
  const old = new Date(Date.now() - 30 * 86400_000).toISOString();
  const cohort = n("SELECT COUNT(*) n FROM companies WHERE approved_at IS NOT NULL AND approved_at < ?", old);
  const retained = n("SELECT COUNT(*) n FROM companies WHERE approved_at IS NOT NULL AND approved_at < ? AND status = 'approved'", old);
  const daily = all<{ d: string; n: number }>(
    "SELECT substr(created_at, 1, 10) d, COUNT(*) n FROM events WHERE kind = 'visit' AND created_at >= ? GROUP BY d ORDER BY d",
    since,
  );
  return {
    visits, starts, completes, requests, matches, quotes, contracts, avgContract, gmv, fee,
    retention: cohort ? retained / cohort : null,
    cohort,
    daily,
    customers: n("SELECT COUNT(*) n FROM users WHERE role = 'customer'"),
    companies: n("SELECT COUNT(*) n FROM companies WHERE status = 'approved'"),
    pendingCompanies: n("SELECT COUNT(*) n FROM companies WHERE status = 'pending'"),
    openReports: n("SELECT COUNT(*) n FROM reports WHERE status = 'open'"),
    flaggedMessages: n("SELECT COUNT(*) n FROM messages WHERE contact_flags != '' AND created_at >= ?", since),
  };
}
