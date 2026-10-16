import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { markMatchSeen } from "@/lib/services";
import { MatchMoment } from "@/components/match-moment";

export const metadata = { title: "マッチしました" };
export const dynamic = "force-dynamic";

export default async function CustomerMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer"], `/match/${id}`);
  const ctx = matchForUser(id, user);
  if (!ctx || ctx.side !== "customer" || ctx.match.status !== "matched") notFound();
  markMatchSeen(id, "customer");
  return (
    <MatchMoment
      title="マッチしました"
      sub={`${ctx.company.name}と相談を始められます。`}
      cta="メッセージを送る"
      href={`/messages/${id}`}
      laterHref={`/projects/${ctx.project.id}`}
    />
  );
}
