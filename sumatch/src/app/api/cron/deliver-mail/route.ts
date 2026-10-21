// Delivers queued notification emails with the configured transport (MAIL_TRANSPORT; none by default).
// curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/deliver-mail
import { NextResponse } from "next/server";
import { deliverOutbox, mailTransportName } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const result = await deliverOutbox();
  return NextResponse.json({ ok: true, transport: mailTransportName(), ...result });
}
