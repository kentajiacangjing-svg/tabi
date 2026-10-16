import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { get } from "@/lib/db";
import { markMatchSeen } from "@/lib/services";
import { MatchMoment } from "@/components/match-moment";

export const metadata = { title: "マッチしました" };
export const dynamic = "force-dynamic";

export default async function BusinessMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireBusiness();
  const ctx = matchForUser(id, user);
  if (!ctx || ctx.side !== "company" || ctx.match.status !== "matched") notFound();
  markMatchSeen(id, "company");
  const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", ctx.project.customer_id);
  return (
    <MatchMoment
      title="マッチしました"
      sub={`${ctx.project.city}の${customer?.name ?? ""}様と相談を始められます。`}
      cta="メッセージを送る"
      href={`/business/messages/${id}`}
      laterHref="/business/active"
    />
  );
}
