import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { get } from "@/lib/db";
import { candidatesForProject, contractForProject, latestQuotesForProject, projectImages } from "@/lib/queries";
import { BUDGETS, TIMINGS } from "@/lib/constants";
import { dateJa, manRange } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { StatusStepper } from "@/components/status-stepper";
import { CancelProjectButton, ReviewForm } from "@/components/project-actions";
import { ContractPanel } from "@/components/contract-panel";
import { ButtonLink, Notice, Row } from "@/components/ui";
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
  const talking = candidatesForProject(project.id).filter((c) => c.status === "matched" || (c.customer_interest && c.company_response !== "no"));
  const quotes = latestQuotesForProject(project.id);
  const contract = contractForProject(project.id);
  const contractCompany = contract ? get<Company>("SELECT * FROM companies WHERE id = ?", contract.company_id) : null;
  const review = get<Review>("SELECT * FROM reviews WHERE project_id = ?", project.id);
  const open = ["consulting", "quoting", "comparing"].includes(project.status);

  // The single most useful next step for this consultation.
  const next = !open
    ? null
    : quotes.length > 0
      ? { label: "見積を比べる", href: `/quotes?project=${project.id}` }
      : talking.some((t) => t.status === "matched")
        ? { label: "メッセージを開く", href: "/messages" }
        : { label: "会社を見る", href: `/matches?project=${project.id}` };

  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/projects" className="-ml-1 mb-4 inline-flex min-h-11 items-center text-[15px] text-muted hover:text-ink">
        ← 相談
      </Link>
      <p className="text-[14px] text-muted">
        {[project.city, project.house_type, dateJa(project.created_at)].filter(Boolean).join("・")}
      </p>
      <h1 className="mt-1 text-[30px] font-semibold">{project.title}</h1>
      <div className="mt-4">
        <StatusStepper status={project.status} />
      </div>
      {decided && <Notice tone="ok" className="mt-6">依頼先を決めました。まだ契約は成立していません。会社から契約条件が届いたら、このページで確認・同意できます。</Notice>}
      {next && (
        <ButtonLink href={next.href} size="lg" className="mt-8 w-full sm:w-auto">
          {next.label}
        </ButtonLink>
      )}

      {contract && contract.status !== "cancelled" && (
        <div className="mt-14">
          <ContractPanel contract={contract} viewer="customer" />
        </div>
      )}

      {contract?.status === "completed" && contractCompany && (
        <section className="mt-14">
          {review ? (
            <>
              <h2 className="text-[20px] font-medium">あなたの口コミ</h2>
              <p className="mt-3 text-[15px]">★ {review.rating}　{review.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{review.body}</p>
            </>
          ) : (
            <ReviewForm projectId={project.id} companyName={contractCompany.name} />
          )}
        </section>
      )}

      {talking.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[20px] font-medium">相談している会社</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {talking.map((c) => {
              const q = quotes.find((x) => x.match_id === c.id);
              return (
                <li key={c.id}>
                  <Link href={c.status === "matched" ? `/messages/${c.id}` : `/company/${c.company.id}?project=${project.id}`} className="flex min-h-16 items-center justify-between gap-4 py-3">
                    <span className="text-[17px]">{c.company.name}</span>
                    <span className="text-[14px] text-muted">{c.status === "matched" ? (q ? `見積 ¥${q.total.toLocaleString("ja-JP")}` : "メッセージ中") : "返事を待っています"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-[20px] font-medium">相談の内容</h2>
        <div className="mt-3">
          <Row label="工事">{category.name}</Row>
          <Row label="予算">{BUDGETS.find((b) => b.min === project.budget_min && b.max === project.budget_max)?.label ?? manRange(project.budget_min, project.budget_max)}</Row>
          <Row label="時期">{TIMINGS.find((t) => t.value === project.desired_timing)?.label ?? "—"}</Row>
          <Row label="場所">{`${project.prefecture}${project.city}`}</Row>
          <Row label="目安">{`約${manRange(project.estimate_min, project.estimate_max)}`}</Row>
        </div>
        {project.details && <p className="mt-5 text-[15px] leading-relaxed text-ink-2">{project.details}</p>}
        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {images.map((f) => (
              <a key={f} href={fileUrl(f)!} target="_blank" rel="noopener" className="aspect-square overflow-hidden rounded-lg bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(f)!} alt="相談の写真" className="size-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>

      {open && (
        <div className="mt-16">
          <CancelProjectButton projectId={project.id} />
        </div>
      )}
    </div>
  );
}
