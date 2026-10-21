// Health check for the host / uptime monitor: is the app up and can it read its database?
// Returns no version, configuration or data.
import { NextResponse } from "next/server";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    get("SELECT 1 AS ok");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
