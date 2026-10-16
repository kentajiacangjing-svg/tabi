import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { candidatesForProject, projectsForCustomer, reasons } from "@/lib/queries";
import { get } from "@/lib/db";
import { CANDIDATES_SHOWN, MAX_MATCHES_PER_PROJECT, PROJECT_STATUS } from "@/lib/constants";
import { manRange, responseSpeed } from "@/lib/format";
import { CompanyAvatar } from "@/components/brand";
import { Icon } from "@/components/icons";
import { MatchActions } from "@/components/match-actions";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader, Stars } from "@/components/ui";
import type { Category } from "@/lib/types";

export const metadata = { title: "条件に合う会社" };
export const dynamic = "force-dynamic";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ project?: string; all?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser(["customer"], "/matches");
  if (!sp.project) {
    const latest = projectsForCustomer(user.id).find((p) => !["cancelled"].includes(p.status));
    if (latest) redirect(`/matches?project=${latest.id}`);
    return (
      <EmptyState icon="search" title="まだ相談がありません" action={<ButtonLink href="/diagnosis">無料で相談する</ButtonLink>}>
        相談内容を入力すると、条件に合う会社が表示されます。
      </EmptyState>
    );
  }
  const project = projectForCustomer(sp.project, user);
  if (!project) redirect("/projects");
  const category = get<Category>("SELECT * FROM categories WHERE id = ?", project.category_id)!;
  const all = candidatesForProject(project.id);
  const closed = ["contracted", "in_progress", "completed", "cancelled"].includes(project.status);
  const requested = all.filter((c) => c.customer_interest && c.company_response !== "no").length;
  const canRequestMore = requested < MAX_MATCHES_PER_PROJECT && !closed;
  // Show the ones already engaged first, then fill up to CANDIDATES_SHOWN with the best remaining fits.
  const engaged = all.filter((c) => c.customer_interest || c.status === "matched");
  const rest = all.filter((c) => !engaged.includes(c) && c.company_response !== "no");
  const showAll = sp.all === "1";
  const visibleRest = showAll ? rest : rest.slice(0, Math.max(0, CANDIDATES_SHOWN - engaged.length));
  const visible = [...engaged, ...visibleRest];
  const hidden = rest.length - visibleRest.length;

  return (
    <div>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "相談の詳細" }}
        eyebrow={`${project.city}・${project.house_type}${project.building_age != null ? `・築${project.building_age}年` : ""}`}
        title={`${category.name}の相談に合う会社`}
        description={`話したい会社を最大${MAX_MATCHES_PER_PROJECT}社まで選べます。会社も「対応したい」と答えた時だけチャットが始まります。`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tone="brand">{PROJECT_STATUS[project.status].label}</Badge>
        <span className="text-muted">
          選択中 {requested} / {MAX_MATCHES_PER_PROJECT}社
        </span>
        <span className="text-faint">・</span>
        <span className="text-muted">参考相場 {manRange(project.estimate_min, project.estimate_max)}</span>
      </div>

      {!project.area_id && (
        <Notice tone="warn" icon="pin" className="mb-6">
          {project.city.trim()}は現在準備中のエリアです。対応できる会社が登録され次第、お知らせします。
        </Notice>
      )}

      {visible.length === 0 && project.area_id && (
        <EmptyState icon="search" title="現在、条件に合う会社を探しています">
          対応できる会社が見つかり次第お知らせします。
        </EmptyState>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const co = c.company;
          const rs = reasons(c);
          return (
            <article key={c.id} className="flex flex-col overflow-hidden rounded-3xl border border-line bg-white">
              <Link href={`/company/${co.id}?project=${project.id}`} className="relative block aspect-[16/9] bg-soft">
                {c.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image} alt="" className="size-full object-cover" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold text-brand-ink shadow-sm">マッチ度 {c.score}%</span>
                {c.status === "matched" && <span className="absolute right-3 top-3 rounded-full bg-ok px-2.5 py-1 text-[11px] font-bold text-white">マッチ成立</span>}
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-3">
                  <CompanyAvatar name={co.name} color={co.brand_color} logoFileId={co.logo_file_id} size={44} />
                  <div className="min-w-0">
                    <Link href={`/company/${co.id}?project=${project.id}`} className="block truncate text-[17px] font-bold hover:underline">
                      {co.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                      <Stars value={co.rating_avg} size={12} />
                      <span className="font-semibold text-ink">{co.rating_avg.toFixed(1)}</span>
                      <span>口コミ{co.review_count}件</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{co.tagline}</p>

                <div className="mt-4 rounded-2xl bg-soft p-3.5">
                  <div className="mb-1.5 text-[11px] font-semibold text-muted">マッチ度の理由</div>
                  <ul className="grid grid-cols-1 gap-1 text-[13px]">
                    {rs.map((r) => (
                      <li key={r} className="flex items-center gap-1.5">
                        <Icon name="check" size={14} className="shrink-0 text-ok" strokeWidth={2.4} />
                        <span className="truncate">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
                  <Spec label="得意分野" value={co.specialties.split(/[,、]/).slice(0, 2).join("・")} />
                  <Spec label={`${category.name}の実績`} value={`${c.works_in_category}件`} />
                  <Spec label="価格帯" value={manRange(co.price_band_min, co.price_band_max)} />
                  <Spec label="返信速度" value={responseSpeed(co.avg_response_minutes)} />
                  <Spec label="施工" value={co.self_construction ? "自社施工" : "提携職人と施工"} />
                  <Spec label="保証" value={co.warranty.split(/[/／]/)[0]} />
                </dl>
                <div className="mt-auto pt-5">
                  <MatchActions
                    matchId={c.id}
                    status={c.status}
                    customerInterest={!!c.customer_interest}
                    companyResponse={c.company_response}
                    canRequestMore={canRequestMore}
                    closed={closed}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hidden > 0 && !closed && (
        <div className="mt-6 text-center">
          <Link href={`/matches?project=${project.id}&all=1`} className="text-sm font-semibold text-brand">
            ほかの候補を見る（{hidden}社）
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-3 rounded-3xl border border-line p-5 text-[13px] leading-relaxed text-muted sm:grid-cols-3">
        <div className="flex gap-2.5">
          <Icon name="lock" size={18} className="shrink-0 text-ink-2" />
          会社に伝わるのは市区町村・住まい・相談内容・写真だけ。連絡先は公開されません。
        </div>
        <div className="flex gap-2.5">
          <Icon name="shield" size={18} className="shrink-0 text-ink-2" />
          表示順は条件との合い具合で決まります。広告や料金による順位づけはしていません。
        </div>
        <div className="flex gap-2.5">
          <Icon name="chat" size={18} className="shrink-0 text-ink-2" />
          マッチ後のやり取りはすべてSUMATCH内のチャットで行えます。
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold">{value || "—"}</dd>
    </div>
  );
}
