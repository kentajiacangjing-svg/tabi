import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { get } from "@/lib/db";
import { candidatesForProject, contractForProject, latestQuotesForProject, projectImages } from "@/lib/queries";
import { BUDGETS, PROJECT_STATUS, TIMINGS } from "@/lib/constants";
import { dateJa, manRange, yen } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { CompanyAvatar } from "@/components/brand";
import { Icon } from "@/components/icons";
import { StatusStepper } from "@/components/status-stepper";
import { AdvanceContractButton, CancelProjectButton, ReviewForm } from "@/components/project-actions";
import { Badge, ButtonLink, Card, Notice, PageHeader, SectionTitle, Stars } from "@/components/ui";
import type { Category, Company, Review } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ decided?: string }> }) {
  const { id } = await params;
  const { decided } = await searchParams;
  const user = await requireUser(["customer"], `/projects/${id}`);
  const project = projectForCustomer(id, user);
  if (!project) notFound();
  const category = get<Category>("SELECT * FROM categories WHERE id = ?", project.category_id)!;
  const images = projectImages(project.id);
  const candidates = candidatesForProject(project.id).filter((c) => c.status === "matched" || c.customer_interest);
  const quotes = latestQuotesForProject(project.id);
  const contract = contractForProject(project.id);
  const contractCompany = contract ? get<Company>("SELECT * FROM companies WHERE id = ?", contract.company_id) : null;
  const review = get<Review>("SELECT * FROM reviews WHERE project_id = ?", project.id);
  const open = ["consulting", "quoting", "comparing"].includes(project.status);

  return (
    <div>
      <PageHeader back={{ href: "/projects", label: "相談一覧" }} eyebrow={`${project.city}・${dateJa(project.created_at)}`} title={project.title} />
      {decided && <Notice tone="ok" icon="check" className="mb-6">依頼先を決定しました。契約内容はこのページにいつでも記録・確認できます。</Notice>}

      <Card className="p-5 sm:p-6">
        <StatusStepper status={project.status} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {contract && contractCompany && (
            <Card className="p-5 sm:p-6">
              <SectionTitle action={<Badge tone="ok">{PROJECT_STATUS[contract.status === "contracted" ? "contracted" : contract.status].label}</Badge>}>契約記録</SectionTitle>
              <div className="flex items-center gap-3">
                <CompanyAvatar name={contractCompany.name} color={contractCompany.brand_color} logoFileId={contractCompany.logo_file_id} size={40} />
                <div className="font-bold">{contractCompany.name}</div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <Item label="契約予定金額" value={yen(contract.amount)} />
                <Item label="契約日" value={dateJa(contract.contract_date)} />
                <Item label="工事予定日" value={dateJa(contract.start_date)} />
                <Item label="完了日" value={dateJa(contract.end_date)} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
                {contract.quote_id && <Link href={`/quotes?project=${project.id}`} className="inline-flex items-center gap-1 font-semibold text-brand"><Icon name="doc" size={15} />採用した見積書</Link>}
                {contract.contract_file_id && <a href={fileUrl(contract.contract_file_id)!} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-brand"><Icon name="pdf" size={15} />契約書</a>}
                <Link href={`/messages/${contract.match_id}`} className="inline-flex items-center gap-1 font-semibold text-brand"><Icon name="chat" size={15} />チャット</Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                {contract.status === "contracted" && <AdvanceContractButton contractId={contract.id} to="in_progress" label="工事中にする" />}
                {contract.status === "in_progress" && <AdvanceContractButton contractId={contract.id} to="completed" label="完了にする" variant="primary" />}
                {contract.status === "completed" && <span className="text-sm text-muted">工事は完了しました。</span>}
              </div>
              <p className="mt-3 text-[12px] text-faint">将来、電子契約・お支払い・工事保証・進捗レポートもここで管理できるようになります。</p>
            </Card>
          )}

          {contract?.status === "completed" && contractCompany && (
            <Card className="p-5 sm:p-6">
              {review ? (
                <div>
                  <SectionTitle>あなたの口コミ</SectionTitle>
                  <Stars value={review.rating} />
                  <div className="mt-1 font-semibold">{review.title}</div>
                  <p className="mt-1 text-sm text-ink-2">{review.body}</p>
                </div>
              ) : (
                <ReviewForm projectId={project.id} companyName={contractCompany.name} />
              )}
            </Card>
          )}

          {open && (
            <div className="grid gap-3 sm:grid-cols-2">
              <NextCard href={`/matches?project=${project.id}`} icon="users" title="会社を選ぶ" body={`${candidates.length}社と進行中`} />
              <NextCard href={`/quotes?project=${project.id}`} icon="compare" title="見積もりを比較" body={quotes.length ? `${quotes.length}件の見積もり` : "まだ届いていません"} />
            </div>
          )}

          {candidates.length > 0 && (
            <Card className="p-5 sm:p-6">
              <SectionTitle>やり取り中の会社</SectionTitle>
              <ul className="divide-y divide-line-2">
                {candidates.map((c) => {
                  const q = quotes.find((x) => x.match_id === c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <CompanyAvatar name={c.company.name} color={c.company.brand_color} logoFileId={c.company.logo_file_id} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{c.company.name}</div>
                        <div className="text-[12px] text-muted">
                          {c.status === "matched" ? (q ? `見積もり ${Math.round(q.total / 10000)}万円` : "チャット中・見積もり待ち") : "返答待ち"}
                        </div>
                      </div>
                      {c.status === "matched" ? (
                        <ButtonLink href={`/messages/${c.id}`} variant="secondary" size="sm">チャット</ButtonLink>
                      ) : (
                        <Badge>返答待ち</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <SectionTitle>相談内容</SectionTitle>
            <dl className="space-y-2.5 text-[13px]">
              <Row label="カテゴリ" value={category.name} />
              <Row label="場所" value={`${project.prefecture}${project.city}`} />
              <Row label="お住まい" value={`${project.house_type}${project.building_age != null ? `・築${project.building_age}年` : ""}`} />
              <Row label="気になること" value={project.concerns || "—"} />
              <Row label="予算" value={BUDGETS.find((b) => b.min === project.budget_min && b.max === project.budget_max)?.label ?? manRange(project.budget_min, project.budget_max)} />
              <Row label="希望時期" value={TIMINGS.find((t) => t.value === project.desired_timing)?.label ?? "—"} />
              <Row label="参考相場" value={`約${manRange(project.estimate_min, project.estimate_max)}`} />
            </dl>
            {project.details && <p className="mt-3 rounded-2xl bg-soft p-3 text-[13px] leading-relaxed text-ink-2">{project.details}</p>}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {images.map((f) => (
                  <a key={f} href={fileUrl(f)!} target="_blank" rel="noopener" className="aspect-square overflow-hidden rounded-xl bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(f)!} alt="" className="size-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>
          {open && (
            <div className="text-center">
              <CancelProjectButton projectId={project.id} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function NextCard({ href, icon, title, body }: { href: string; icon: string; title: string; body: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-3xl border border-line bg-white p-5 hover:border-ink/20">
      <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-[13px] text-muted">{body}</span>
      </span>
      <Icon name="chevron-right" size={18} className="text-faint" />
    </Link>
  );
}
