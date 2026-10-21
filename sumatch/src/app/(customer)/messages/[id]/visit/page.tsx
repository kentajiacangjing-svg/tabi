import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { VisitPanel } from "@/components/visit-panel";

export const metadata = { title: "現地調査" };
export const dynamic = "force-dynamic";

export default async function CustomerVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer"], `/messages/${id}/visit`);
  const ctx = matchForUser(id, user);
  if (!ctx || ctx.side !== "customer" || ctx.match.status !== "matched") notFound();
  return <VisitPanel ctx={ctx} viewerUserId={user.id} />;
}
