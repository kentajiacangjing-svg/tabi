import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { companyProfile, workImage } from "@/lib/queries";
import { cityOf, dateShort, manRange, responseSpeed } from "@/lib/format";
import { MAX_MATCHES_PER_PROJECT } from "@/lib/constants";
import { Icon } from "@/components/icons";
import { ConsultButton } from "@/components/saved-actions";
import { Row } from "@/components/ui";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: companyProfile(id)?.company.name ?? "会社" };
}

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ project?: string }> }) {
  const { id } = await params;
  const { project } = await searchParams;
  const p = companyProfile(id);
  const user = await getCurrentUser();
  if (!p || (p.company.status !== "approved" && user?.role !== "admin")) notFound();
  const c = p.company;

  // Offer 「相談する」 only when the visitor is looking at this company for one of their own consultations.
  const match =
    project && user?.role === "customer"
      ? get<Match & { customer_id: string; project_status: string }>(
          "SELECT m.*, p.customer_id, p.status AS project_status FROM matches m JOIN projects p ON p.id = m.project_id WHERE m.project_id = ? AND m.company_id = ?",
          project,
          c.id,
        )
      : undefined;
  const own = match && match.customer_id === user?.id ? match : undefined;
  const requested = own
    ? (get<{ n: number }>("SELECT COUNT(*) n FROM matches WHERE project_id = ? AND customer_interest = 1 AND company_response != 'no'", own.project_id)?.n ?? 0)
    : 0;
  const hero = p.works[0];

  return (
    <div className="mx-auto max-w-[760px]">
      <Link href={project ? `/matches?project=${project}` : "/"} className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-ink">
        <Icon name="chevron-left" size={18} />
        戻る
      </Link>

      {hero && workImage(hero) && (
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-soft sm:aspect-[16/9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={workImage(hero)!} alt={hero.title} className="size-full object-cover" />
        </div>
      )}

      <h1 className="mt-8 text-[30px] font-semibold leading-tight">{c.name}</h1>
      <p className="mt-1 text-[16px] text-ink-2">
        {cityOf(c.address)} / {p.categories.map((x) => x.name).join("・")}
      </p>
      <p className="mt-2 text-[15px] text-ink-2">
        ★ {c.rating_avg.toFixed(1)}
        <span className="text-muted">（口コミ{c.review_count}件）</span>
        <span className="mx-2 text-line">|</span>施工実績 {c.works_total.toLocaleString()}件
      </p>
      <p className="mt-6 text-[18px] leading-relaxed">「{c.tagline}」</p>
      <p className="mt-4 whitespace-pre-wrap text-[16px] leading-[1.9] text-ink-2">{c.description}</p>

      {own && own.status !== "matched" && !own.customer_interest && (
        <div className="mt-10">
          <ConsultButton
            matchId={own.id}
            disabledReason={
              !["consulting", "quoting", "comparing"].includes(own.project_status)
                ? "この相談は依頼先が決まっています。"
                : requested >= MAX_MATCHES_PER_PROJECT
                  ? `相談できるのは${MAX_MATCHES_PER_PROJECT}社までです。`
                  : undefined
            }
          />
        </div>
      )}
      {own?.status === "matched" && (
        <Link href={`/messages/${own.id}`} className="mt-10 flex h-14 items-center justify-center rounded-xl bg-brand text-white">
          メッセージを開く
        </Link>
      )}

      {p.works.length > 1 && (
        <section className="mt-16">
          <h2 className="text-[22px] font-semibold">施工事例</h2>
          <div className="no-scrollbar -mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0">
            {p.works.map((w) => (
              <figure key={w.id} className="w-72 shrink-0 snap-start sm:w-auto">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {workImage(w) && <img src={workImage(w)!} alt={w.title} className="size-full object-cover" />}
                </div>
                <figcaption className="mt-2 text-[15px]">
                  {w.title}
                  <span className="block text-[14px] text-muted">{w.cost_label}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <h2 className="text-[22px] font-semibold">会社について</h2>
        <div className="mt-4">
          <Row label="対応エリア">{p.areas.map((a) => a.city).join("、")}</Row>
          <Row label="得意な工事">{c.specialties}</Row>
          <Row label="価格帯">{manRange(c.price_band_min, c.price_band_max)}</Row>
          <Row label="保証">{c.warranty}</Row>
          <Row label="施工">{c.self_construction ? "自社の職人が施工" : "提携職人と施工（品質管理は自社）"}</Row>
          <Row label="返信の目安">{responseSpeed(c.avg_response_minutes)}</Row>
          {c.license_number && <Row label="建設業許可">{c.license_number}</Row>}
          {c.qualifications && <Row label="資格">{c.qualifications}</Row>}
          {c.founded_year && <Row label="創業">{c.founded_year}年</Row>}
          <Row label="所在地">{c.address}</Row>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[22px] font-semibold">口コミ</h2>
        {p.reviews.length === 0 ? (
          <p className="mt-4 text-[15px] text-muted">まだ口コミはありません。</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {p.reviews.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span>★ {r.rating}</span>
                  <span className="text-muted">{r.author_label}・{dateShort(r.created_at)}</span>
                </div>
                {r.title && <div className="mt-2 text-[16px] font-medium">{r.title}</div>}
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {c.website_url && (
        <a href={c.website_url} target="_blank" rel="nofollow noopener noreferrer" className="mt-10 inline-flex min-h-11 items-center gap-1 text-[14px] text-muted hover:text-ink">
          公式サイト <Icon name="external" size={13} />
        </a>
      )}
    </div>
  );
}
