import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { companyProfile, workImage } from "@/lib/queries";
import { cityOf, dateShort, manRange, responseSpeed } from "@/lib/format";
import { MAX_MATCHES_PER_PROJECT } from "@/lib/constants";
import { Icon } from "@/components/icons";
import { ConsultButton } from "@/components/saved-actions";
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
  const consultable = own && own.status !== "matched" && !own.customer_interest;
  const reason = !own
    ? undefined
    : !["consulting", "quoting", "comparing"].includes(own.project_status)
      ? "この相談は依頼先が決まっています。"
      : requested >= MAX_MATCHES_PER_PROJECT
        ? `相談できるのは${MAX_MATCHES_PER_PROJECT}社までです。`
        : undefined;

  const specialties = c.specialties.split(/[,、]\s*/).filter(Boolean).slice(0, 4);

  return (
    <div className="mx-auto">
      <Link href={project ? `/matches?project=${project}` : "/"} className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] text-muted hover:text-ink">
        <Icon name="chevron-left" size={18} />
        戻る
      </Link>

      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* 1. photo */}
        <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hero && workImage(hero) && <img src={workImage(hero)!} alt={hero.title} className="size-full object-cover" />}
        </div>

        {/* 2–3. name, rating, area → 相談したい (overlaps the photo on phones, sticks beside it on wide screens) */}
        <aside className="relative z-10 mx-3 -mt-12 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:mt-0">
          <div className="rounded-[24px] bg-surface p-6 shadow-[var(--shadow-pop)] lg:sticky lg:top-24">
            <h1 className="jp text-[26px] font-bold leading-tight sm:text-[30px]">{c.name}</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="tnum text-[22px] font-semibold leading-none">★ {c.rating_avg.toFixed(1)}</span>
              <span className="text-[14px] text-muted">口コミ{c.review_count}件</span>
            </div>
            <p className="mt-3 text-[14px] text-muted">{p.areas.map((a) => a.city).join("・")}</p>
            {c.status === "approved" && (
              <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-brand-2">
                <Icon name="shield" size={15} />
                会社確認済み
              </p>
            )}
            {consultable && (
              <div className="mt-6">
                <ConsultButton matchId={own.id} disabledReason={reason} />
              </div>
            )}
            {own?.status === "matched" && (
              <Link href={`/messages/${own.id}`} className="press mt-6 flex h-14 items-center justify-center rounded-xl bg-brand font-medium text-white hover:bg-brand-2">
                メッセージを開く
              </Link>
            )}
            <p className="mt-4 text-center text-[13px] text-muted">返信の目安 {responseSpeed(c.avg_response_minutes)}</p>
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1">
          {/* 4. 施工事例 */}
          {p.works.length > 0 && (
            <section className="mt-12">
              <h2 className="text-[22px] font-bold">施工事例</h2>
              <div className="no-scrollbar -mx-5 mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 sm:mx-0 sm:scroll-px-0 sm:px-0 lg:grid lg:grid-cols-2 lg:gap-4">
                {p.works.map((w) => (
                  <figure key={w.id} className="w-64 shrink-0 snap-start lg:w-auto">
                    <div className="aspect-[4/3] overflow-hidden rounded-[24px] bg-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {workImage(w) && <img src={workImage(w)!} alt={w.title} className="size-full object-cover" />}
                    </div>
                    <figcaption className="mt-2.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium">{w.title}</span>
                      <span className="tnum shrink-0 text-[13px] text-muted">{w.cost_label}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* 5–6. 得意な工事・価格帯 */}
          <section className="mt-12 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="text-[13px] text-muted">得意な工事</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {specialties.map((t) => (
                  <span key={t} className="rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-brand">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="text-[13px] text-muted">価格帯</div>
              <div className="tnum mt-1.5 text-[26px] font-semibold leading-tight">{manRange(c.price_band_min, c.price_band_max)}</div>
            </div>
          </section>

          {/* 7. 口コミ */}
          <section className="mt-12 rounded-[28px] bg-brand-soft p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-[22px] font-bold text-brand-ink">口コミ</h2>
              <span className="tnum text-[15px] text-brand-ink">
                <span className="text-[32px] font-semibold leading-none">{c.rating_avg.toFixed(1)}</span> / 5
              </span>
            </div>
            {p.reviews.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">まだ口コミはありません。</p>
            ) : (
              <ul className="mt-5 grid gap-3 lg:grid-cols-2">
                {p.reviews.slice(0, 4).map((r) => (
                  <li key={r.id} className="rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="font-semibold">★ {r.rating}</span>
                      <span className="text-[13px] text-muted">
                        {r.author_label}・{dateShort(r.created_at)}
                      </span>
                    </div>
                    {r.title && <div className="mt-2 text-[16px] font-semibold">{r.title}</div>}
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 8. 保証・資格 */}
          <section className="mt-12">
            <h2 className="text-[22px] font-bold">保証・資格</h2>
            <div className="mt-3">
              <Row label="保証">{c.warranty || "—"}</Row>
              {c.qualifications && <Row label="資格">{c.qualifications}</Row>}
              {c.license_number && <Row label="建設業許可">{c.license_number}</Row>}
            </div>
          </section>

          {/* 9. 会社情報 */}
          <section className="mt-12">
            <h2 className="text-[22px] font-bold">会社情報</h2>
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.9] text-ink-2">{c.description}</p>
            <div className="mt-4">
              <Row label="施工">{c.self_construction ? "自社の職人" : "提携職人（品質管理は自社）"}</Row>
              <Row label="施工実績">{c.works_total.toLocaleString()}件</Row>
              {c.founded_year && <Row label="創業">{c.founded_year}年</Row>}
              <Row label="所在地">{cityOf(c.address)}</Row>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-3.5 text-[15px] last:border-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
