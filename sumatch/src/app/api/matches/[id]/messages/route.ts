import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { messagesFor } from "@/lib/queries";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const ctx = user ? matchForUser(id, user) : null;
  if (!ctx) return NextResponse.json({ error: "not found" }, { status: 404 });
  const m = get<{ customer_last_read_at: string | null; company_last_read_at: string | null }>(
    "SELECT customer_last_read_at, company_last_read_at FROM matches WHERE id = ?",
    id,
  );
  return NextResponse.json({
    messages: messagesFor(id),
    otherReadAt: ctx.side === "customer" ? m?.company_last_read_at : m?.customer_last_read_at,
  });
}
