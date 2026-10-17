import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { candidatesForProject, projectsForCustomer, reasons } from "@/lib/queries";
import { MAX_MATCHES_PER_PROJECT } from "@/lib/constants";
import { manRange } from "@/lib/format";
import { all as allQ } from "@/lib/db";
import { CompanyDeck, type DeckCompany } from "@/components/company-deck";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "あなたに合いそうな会社" };
export const dynamic = "force-dynamic";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ project?: string; again?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser(["customer"], "/matches");
  if (!sp.project) {
    const latest = projectsForCustomer(user.id).find((p) => p.status !== "cancelled");
    if (latest) redirect(`/matches?project=${latest.id}`);
    return (
      <EmptyState title="まだ相談がありません" action={<ButtonLink href="/">相談を始める</ButtonLink>}>
        工事の種類を選ぶところから始められます。
      </EmptyState>
    );
  }
  const project = projectForCustomer(sp.project, user);
  if (!project) redirect("/projects");
  const closed = ["contracted", "in_progress", "completed", "cancelled"].includes(project.status);
  if (closed) redirect(`/projects/${project.id}`);

  const all = candidatesForProject(project.id);
  const requested = all.filter((c) => c.customer_interest && c.company_response !== "no").length;
  const again = sp.again === "1"; // show companies the customer passed on, too
  const deck: DeckCompany[] = all
    .filter((c) => c.status === "candidate" && !c.customer_interest && !c.customer_saved && c.company_response !== "no" && (again || !c.customer_passed))
    .sort((a, b) => Number(b.company_response === "yes") - Number(a.company_response === "yes") || b.score - a.score)
    .map((c) => ({
      matchId: c.id,
      companyId: c.company.id,
      name: c.company.name,
      areas: allQ<{ city: string }>("SELECT a.city FROM company_areas ca JOIN service_areas a ON a.id = ca.area_id WHERE ca.company_id = ? ORDER BY a.sort", c.company.id)
        .map((a) => a.city)
        .join("・"),
      priceBand: manRange(c.company.price_band_min, c.company.price_band_max),
      specialties: c.company.specialties.split(/[,、]\s*/).slice(0, 3).join("・"),
      rating: c.company.rating_avg,
      reviews: c.company.review_count,
      photo: c.cover_image,
      photoCaption: c.cover_title,
      verified: c.company.status === "approved",
      wantsYou: c.company_response === "yes",
    }));

  return (
    <div>
      {!project.area_id ? (
        <EmptyState title={`${project.city.trim()}は準備中のエリアです`}>対応できる会社が見つかり次第、お知らせします。</EmptyState>
      ) : (
        <>
          <h1 className="sr-only">あなたに合いそうな会社</h1>
          <CompanyDeck projectId={project.id} deck={deck} consultLeft={MAX_MATCHES_PER_PROJECT - requested} />
        </>
      )}
    </div>
  );
}
