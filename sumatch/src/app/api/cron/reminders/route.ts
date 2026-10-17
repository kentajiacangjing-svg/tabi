// 「見積期限が近づいています」リマインド。外部スケジューラから1日1回 POST する想定。
// curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders
import { NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { notify, companyUserIds } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  // Matched 4+ days ago, project still open, and this company has not submitted a quote yet.
  const cutoff = new Date(Date.now() - 4 * 86400_000).toISOString();
  const rows = all<{ id: string; company_id: string; project_id: string; city: string; title: string }>(
    `SELECT m.id, m.company_id, m.project_id, p.city, p.title FROM matches m JOIN projects p ON p.id = m.project_id
      WHERE m.status = 'matched' AND m.matched_at < ? AND p.status IN ('consulting','quoting','comparing')
        AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.match_id = m.id)`,
    cutoff,
  );
  let sent = 0;
  for (const r of rows) {
    const today = new Date().toISOString().slice(0, 10);
    const already = get("SELECT 1 FROM notifications WHERE kind = 'quote_due' AND link = ? AND substr(created_at,1,10) = ?", `/business/quotes/new?match=${r.id}`, today);
    if (already) continue;
    notify(companyUserIds(r.company_id), "quote_due", "見積期限が近づいています", `${r.city}・${r.title}。お客様は他社と比較中です。`, `/business/quotes/new?match=${r.id}`);
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
