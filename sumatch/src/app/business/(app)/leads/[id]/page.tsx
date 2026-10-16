import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { projectForCompany } from "@/lib/access";
import { get } from "@/lib/db";
import { projectImages, reasons } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { PROJECT_STATUS, TIMINGS } from "@/lib/constants";
import { dateJa, manRange } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { Icon } from "@/components/icons";
import { LeadActions } from "@/components/lead-actions";
import { Badge, Card, Notice, PageHeader, SectionTitle } from "@/components/ui";
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
  const usage = monthlyMatchUsage(company.id);
  const limit = matchLimitFor(company);
  const overLimit = match.customer_interest && usage >= limit ? `今月のマッチ上限（${limit}件）に達しています。プラン変更で上限を増やせます。` : undefined;

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/business/leads", label: "案件一覧" }}
        eyebrow={`${dateJa(project.created_at)} 受付`}
        title={`${project.city}・${cat.name}`}
        description={customer ? `${customer.name}様の相談` : "お客様のお名前はマッチ成立後に表示されます。"}
      />
      {match.customer_interest && match.status !== "matched" && (
        <Notice tone="brand" icon="users" className="mb-5">お客様があなたの会社と話したいと希望しています。「対応したい」を押すとすぐにチャットが始まります。</Notice>
      )}
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="brand">マッチ度 {match.score}%</Badge>
          <Badge>{PROJECT_STATUS[project.status].label}</Badge>
        </div>
        <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2.5 text-sm">
          <dt className="text-muted">場所</dt>
          <dd>{project.prefecture}{project.city}</dd>
          <dt className="text-muted">住宅</dt>
          <dd>{project.house_type}{project.building_age != null && `・築${project.building_age}年`}</dd>
          <dt className="text-muted">工事内容</dt>
          <dd>{cat.name}</dd>
          <dt className="text-muted">気になること</dt>
          <dd>{project.concerns || "—"}</dd>
          <dt className="text-muted">希望時期</dt>
          <dd>{TIMINGS.find((t) => t.value === project.desired_timing)?.label}</dd>
          <dt className="text-muted">予算</dt>
          <dd>{manRange(project.budget_min, project.budget_max)}</dd>
          <dt className="text-muted">連絡しやすい時間</dt>
          <dd>{project.contact_time || "—"}</dd>
        </dl>
        {project.details && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-soft p-4 text-sm leading-relaxed">{project.details}</p>}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
          {reasons(match).map((r) => <span key={r}>✓ {r}</span>)}
        </div>
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <SectionTitle>写真（{images.length}枚）</SectionTitle>
        {images.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Icon name="image" size={16} />写真はありません。チャットで依頼できます。</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((f) => (
              <a key={f} href={fileUrl(f)!} target="_blank" rel="noopener" className="aspect-[4/3] overflow-hidden rounded-2xl bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(f)!} alt="" className="size-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="sticky bottom-20 z-10 mt-6 rounded-3xl border border-line bg-white/95 p-4 shadow-[var(--shadow-pop)] backdrop-blur md:bottom-4">
        <LeadActions projectId={project.id} matchId={match.id} response={match.company_response} matched={match.status === "matched"} closed={!open} disabled={overLimit} />
      </div>
    </div>
  );
}
