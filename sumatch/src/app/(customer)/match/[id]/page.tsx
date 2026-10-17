import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { markMatchSeen } from "@/lib/services";
import { MatchMoment } from "@/components/match-moment";
import { get } from "@/lib/db";
import { workImage } from "@/lib/queries";
import { fileUrl } from "@/lib/urls";

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
      sub={ctx.company.name}
      photo={workImage(get<{ image_url: string | null; file_id: string | null }>("SELECT image_url, file_id FROM company_works WHERE company_id = ? ORDER BY (category_id = ?) DESC LIMIT 1", ctx.company.id, ctx.project.category_id)) ?? fileUrl(ctx.company.logo_file_id)}
      initial={ctx.company.name.slice(0, 1)}
      cta="メッセージを送る"
      href={`/messages/${id}`}
      laterHref={`/projects/${ctx.project.id}`}
    />
  );
}
