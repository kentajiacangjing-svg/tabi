// Erases personal data past its display period (see lib/retention.ts). Also runs hourly inside the server.
// curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/purge
import { NextResponse } from "next/server";
import { purgeExpired } from "@/lib/retention";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ ok: true, ...purgeExpired() });
}
