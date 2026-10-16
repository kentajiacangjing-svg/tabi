import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { companyProfile, workImage } from "@/lib/queries";
import { dateShort, manRange, responseSpeed } from "@/lib/format";
import { CompanyAvatar } from "@/components/brand";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, SectionTitle, Stars } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = companyProfile(id);
  return { title: p?.company.name ?? "企業プロフィール" };
}

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> }) {
  const { id } = await params;
  const { project } = await searchParams;
  const p = companyProfile(id);
  const user = await getCurrentUser();
  if (!p || (p.company.status !== "approved" && user?.role !== "admin")) notFound();
  const { company: c } = p;
  return (
    <div>
      <Link href={project ? `/matches?project=${project}` : "/projects"} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevron-left" size={16} />
        {project ? "候補一覧へ戻る" : "戻る"}
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <CompanyAvatar name={c.name} color={c.brand_color} logoFileId={c.logo_file_id} size={72} className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold tracking-tight">{c.name}</h1>
          <p className="mt-1 text-ink-2">{c.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><Stars value={c.rating_avg} /><b className="text-ink">{c.rating_avg.toFixed(1)}</b>（口コミ{c.review_count}件）</span>
            <span>施工実績 {c.works_total.toLocaleString()}件</span>
            {c.founded_year && <span>創業 {c.founded_year}年</span>}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {p.categories.map((cat) => <Badge key={cat.id} tone="brand">{cat.name}（{cat.works_count}件）</Badge>)}
        {c.self_construction ? <Badge tone="ok">自社施工</Badge> : <Badge>提携職人と施工</Badge>}
      </div>

      {p.works.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
          {p.works.map((w) => (
            <figure key={w.id} className="w-64 shrink-0 snap-start sm:w-auto">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {workImage(w) && <img src={workImage(w)!} alt={w.title} className="size-full object-cover" />}
              </div>
              <figcaption className="mt-2 text-[13px]">
                <div className="font-semibold">{w.title}</div>
                <div className="text-muted">{w.cost_label}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle>会社紹介</SectionTitle>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{c.description}</p>
          </Card>
          <Card className="p-5 sm:p-6">
            <SectionTitle>口コミ</SectionTitle>
            {p.reviews.length === 0 ? (
              <p className="text-sm text-muted">まだ口コミはありません。</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {p.reviews.map((r) => (
                  <li key={r.id} className="py-4 first:pt-0">
                    <div className="flex items-center justify-between">
                      <Stars value={r.rating} />
                      <span className="text-[12px] text-faint">{r.author_label}・{dateShort(r.created_at)}</span>
                    </div>
                    {r.title && <div className="mt-1.5 font-semibold">{r.title}</div>}
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <dl className="space-y-3 text-[13px]">
              <Row label="対応エリア" value={p.areas.map((a) => a.city).join("、")} />
              <Row label="得意工事" value={c.specialties} />
              <Row label="価格帯" value={manRange(c.price_band_min, c.price_band_max)} />
              <Row label="保証" value={c.warranty} />
              <Row label="返信速度" value={responseSpeed(c.avg_response_minutes)} />
              <Row label="営業時間" value={c.business_hours} />
              {c.license_number && <Row label="建設業許可" value={c.license_number} />}
              {c.qualifications && <Row label="資格" value={c.qualifications} />}
              <Row label="所在地" value={c.address} />
            </dl>
            {c.website_url && (
              <a href={c.website_url} target="_blank" rel="nofollow noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                公式サイト <Icon name="external" size={12} />
              </a>
            )}
          </Card>
          <div className="rounded-3xl bg-soft p-5 text-[13px] leading-relaxed text-ink-2">
            <div className="mb-1 flex items-center gap-1.5 font-bold text-ink"><Icon name="shield" size={16} />SUMATCHで相談するメリット</div>
            見積もり・やり取りが記録に残り、契約内容もまとめて管理できます。今後は工事保証・お支払い管理も追加予定です。
          </div>
          {!project && <ButtonLink href="/diagnosis" className="w-full">この分野で相談する</ButtonLink>}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}
