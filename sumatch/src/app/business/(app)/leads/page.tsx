import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { leadsForCompany } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { BUDGETS, TIMINGS } from "@/lib/constants";
import { manRange, relative } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { LeadDeck } from "@/components/lead-deck";
import { categoryPhoto } from "@/lib/visuals";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "新しい相談" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { membership } = await requireBusiness();
  const company = membership.company;
  if (company.status !== "approved") {
    return (
      <div className="mx-auto max-w-[640px]">
        <EmptyState title="審査が終わると、ここに相談が届きます">通常1〜2営業日で完了します。その間に会社の情報と施工事例を整えておきましょう。</EmptyState>
      </div>
    );
  }
  const open = (s: string) => ["consulting", "quoting", "comparing"].includes(s);
  const leads = leadsForCompany(company.id)
    .filter((l) => l.company_response === "none" && l.match_status === "candidate" && open(l.project_status))
    .map((l) => {
      const project = get<{ details: string }>("SELECT details FROM projects WHERE id = ?", l.project_id);
      const photo = get<{ file_id: string }>("SELECT file_id FROM project_images WHERE project_id = ? ORDER BY sort LIMIT 1", l.project_id);
      return {
        projectId: l.project_id,
        city: l.city,
        category: l.category_name,
        cover: categoryPhoto(l.category_slug),
        houseType: `${l.house_type}${l.building_age != null ? `・築${l.building_age}年` : ""}`,
        budget: BUDGETS.find((b) => b.min === l.budget_min && b.max === l.budget_max)?.label ?? manRange(l.budget_min, l.budget_max),
        timing: TIMINGS.find((t) => t.value === l.desired_timing)?.label ?? "—",
        photos: l.photo_count,
        photo: fileUrl(photo?.file_id),
        details: (project?.details ?? "").slice(0, 120),
        customerWants: !!l.customer_interest,
        received: relative(l.created_at),
      };
    });
  const limit = matchLimitFor(company);
  const blocked = monthlyMatchUsage(company.id) >= limit ? `今月のマッチ上限（${limit}件）に達しています。会社ページからプランを変更できます。` : undefined;
  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="sr-only">新しい相談</h1>
      <LeadDeck leads={leads} blockedReason={blocked} />
    </div>
  );
}
