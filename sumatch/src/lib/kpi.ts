import { all, get } from "./db";
import { agreedSql } from "./contract-terms";

const n = (sql: string, ...p: string[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;

export function kpis(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const visits = n("SELECT COUNT(*) n FROM events WHERE kind = 'visit' AND created_at >= ?", since);
  const starts = n("SELECT COUNT(*) n FROM events WHERE kind = 'diagnosis_start' AND created_at >= ?", since);
  const completes = n("SELECT COUNT(*) n FROM events WHERE kind = 'diagnosis_complete' AND created_at >= ?", since);
  const companyViews = n("SELECT COUNT(DISTINCT COALESCE(user_id, session_key)) n FROM events WHERE kind = 'company_view' AND created_at >= ?", since);
  const requests = n("SELECT COUNT(*) n FROM matches WHERE customer_interest = 1 AND customer_interest_at >= ?", since);
  const matches = n("SELECT COUNT(*) n FROM matches WHERE matched_at >= ?", since);
  // Matches → quotes → contracts are counted on the cohort of matches made in the window, so each step is a subset of the previous one.
  const quotes = n("SELECT COUNT(DISTINCT q.match_id) n FROM quotes q JOIN matches m ON m.id = q.match_id WHERE m.matched_at >= ?", since);
  // 依頼先決定 is not a contract: only terms both sides agreed to count as 合意 / 成約金額 / 成功報酬.
  const decided = n("SELECT COUNT(*) n FROM contracts c JOIN matches m ON m.id = c.match_id WHERE c.status != 'cancelled' AND m.matched_at >= ?", since);
  const contracts = n(`SELECT COUNT(*) n FROM contracts c JOIN matches m ON m.id = c.match_id WHERE ${agreedSql("c.")} AND m.matched_at >= ?`, since);
  const avgContract = get<{ a: number | null }>(`SELECT AVG(amount) a FROM contracts WHERE ${agreedSql()} AND created_at >= ?`, since)?.a ?? null;
  const gmv = get<{ s: number | null }>(`SELECT SUM(amount) s FROM contracts WHERE ${agreedSql()} AND created_at >= ?`, since)?.s ?? 0;
  const fee = get<{ s: number | null }>(`SELECT SUM(amount * success_fee_rate) s FROM contracts WHERE ${agreedSql()} AND created_at >= ?`, since)?.s ?? 0;
  // Retention: approved companies older than 30 days that are still active (not suspended).
  const old = new Date(Date.now() - 30 * 86400_000).toISOString();
  const cohort = n("SELECT COUNT(*) n FROM companies WHERE approved_at IS NOT NULL AND approved_at < ?", old);
  const retained = n("SELECT COUNT(*) n FROM companies WHERE approved_at IS NOT NULL AND approved_at < ? AND status = 'approved'", old);
  const daily = all<{ d: string; n: number }>(
    "SELECT substr(created_at, 1, 10) d, COUNT(*) n FROM events WHERE kind = 'visit' AND created_at >= ? GROUP BY d ORDER BY d",
    since,
  );
  return {
    visits, starts, completes, companyViews, requests, matches, quotes, decided, contracts, avgContract, gmv, fee,
    retention: cohort ? retained / cohort : null,
    cohort,
    daily,
    customers: n("SELECT COUNT(*) n FROM users WHERE role = 'customer'"),
    projectsTotal: n("SELECT COUNT(*) n FROM projects"),
    matchesTotal: n("SELECT COUNT(*) n FROM matches WHERE status = 'matched' OR matched_at IS NOT NULL"),
    quotesTotal: n("SELECT COUNT(DISTINCT match_id) n FROM quotes"),
    decidedTotal: n("SELECT COUNT(*) n FROM contracts WHERE status != 'cancelled'"),
    contractsTotal: n(`SELECT COUNT(*) n FROM contracts WHERE ${agreedSql()}`),
    contactBlocks: n("SELECT COUNT(*) n FROM contact_blocks WHERE created_at >= ?", since),
    companies: n("SELECT COUNT(*) n FROM companies WHERE status = 'approved'"),
    pendingCompanies: n("SELECT COUNT(*) n FROM companies WHERE status = 'pending'"),
    openReports: n("SELECT COUNT(*) n FROM reports WHERE status = 'open'"),
    flaggedMessages: n("SELECT COUNT(*) n FROM messages WHERE contact_flags != '' AND created_at >= ?", since),
  };
}
