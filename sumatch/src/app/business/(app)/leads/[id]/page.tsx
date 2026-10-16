import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { projectForCompany } from "@/lib/access";
import { get } from "@/lib/db";
import { projectImages } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { BUDGETS, PROJECT_STATUS, TIMINGS } from "@/lib/constants";
import { dateJa, manRange } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { LeadActions } from "@/components/lead-actions";
import { Row } from "@/components/ui";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireBusiness();
  const company = membership.company;
  const found = company.status === "approved" ? projectForCompany(id, company.id) : null;
  if (!found) notFound();
  const { project, match } = found;
  const cat = get<Category>("SELECT * FROM categories WHERE id = ?", project.category_id)!;
  const images = projectImages(project.id);
  const customer = match.status === "matched" ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", project.customer_id) : null;
  const open = ["consulting", "quoting", "comparing"].includes(project.status);
  const limit = matchLimitFor(company);
  const overLimit = match.customer_interest && monthlyMatchUsage(company.id) >= limit ? `今月のマッチ上限（${limit}件）に達しています。` : undefined;

  return (
    <div className="mx-auto max-w-[680px]">
      <Link href="/business/leads" className="-ml-1 mb-4 inline-flex min-h-11 items-center text-[15px] text-muted hover:text-ink">
        ← 新しい相談
      </Link>
      <p className="text-[14px] text-muted">{dateJa(project.created_at)}に届いた相談</p>
      <h1 className="mt-1 text-[34px] font-semibold leading-tight">{project.city}</h1>
      <p className="mt-1 text-[20px]">{cat.name}</p>
      {customer && <p className="mt-2 text-[15px] text-ink-2">{customer.name}様</p>}
      {match.customer_interest && match.status !== "matched" ? <p className="mt-4 text-[15px] font-medium text-brand">お客様があなたの会社に相談したいと希望しています</p> : null}

      {images.length > 0 && (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {images.map((f, i) => (
            <a key={f} href={fileUrl(f)!} target="_blank" rel="noopener" className={i === 0 ? "aspect-[4/3] overflow-hidden rounded-2xl bg-soft sm:col-span-2" : "aspect-[4/3] overflow-hidden rounded-xl bg-soft"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(f)!} alt={`お客様の写真 ${i + 1}`} className="size-full object-cover" />
            </a>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Row label="予算">{BUDGETS.find((b) => b.min === project.budget_min && b.max === project.budget_max)?.label ?? manRange(project.budget_min, project.budget_max)}</Row>
        <Row label="希望時期">{TIMINGS.find((t) => t.value === project.desired_timing)?.label ?? "—"}</Row>
        <Row label="お住まい">{`${project.house_type}${project.building_age != null ? `・築${project.building_age}年` : ""}`}</Row>
        {project.concerns && <Row label="気になること">{project.concerns}</Row>}
        <Row label="状況">{PROJECT_STATUS[project.status].label}</Row>
      </div>
      {project.details && <p className="mt-6 whitespace-pre-wrap text-[16px] leading-relaxed text-ink-2">「{project.details}」</p>}
      <p className="mt-6 text-[14px] text-muted">お客様の名前と連絡先は、マッチ後もSUMATCHの外には表示されません。</p>

      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] -mx-5 mt-8 border-t border-line bg-canvas px-5 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <LeadActions projectId={project.id} matchId={match.id} response={match.company_response} matched={match.status === "matched"} closed={!open} disabled={overLimit} />
      </div>
    </div>
  );
}
