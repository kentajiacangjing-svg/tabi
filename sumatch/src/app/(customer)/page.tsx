import Link from "next/link";
import { activeAreas, activeCategories, projectsForCustomer, workImage } from "@/lib/queries";
import { all, get } from "@/lib/db";
import { HERO_PHOTO } from "@/lib/visuals";
import { demoVisibleSql } from "@/lib/demo";
import { Icon } from "@/components/icons";
import { ImageTag, Kicker, SampleTag } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { CategoryPicker } from "@/components/category-picker";
import { Track } from "@/components/track";

export const dynamic = "force-dynamic";

const FEATURED = 4;

const steps = [
  ["4つ答える", "工事・予算・時期・場所。タップだけです。"],
  ["会社を1社ずつ見る", "気になる会社に「相談したい」。"],
  ["比べて、決める", "見積を並べて比較。お断りはSUMATCHから。"],
];

const reasons = [
  ["電話番号はいりません", "やり取りはSUMATCHのメッセージだけ。"],
  ["話すのは、選んだ会社だけ", "双方が希望した時だけ会話が始まります。"],
  ["審査済みの会社だけ", "運営が確認した会社だけをご紹介します。"],
];

const faq = [
  ["本当に無料ですか？", "はい。相談・見積・比較まで、ご利用者さまの費用はかかりません。会社からの紹介料で運営しています。"],
  ["見積を取ったら断れますか？", "断れます。依頼先を決めたあとも、契約条件にお客様と会社の双方が同意するまでは契約になりません。他社へのお断りもSUMATCHからお伝えします。"],
  ["どの地域で使えますか？", "いまは神奈川県の湘南エリア（藤沢市・茅ヶ崎市・平塚市）から始めています。"],
  ["表示される会社の順番は？", "地域・予算・実績・口コミなど、ご相談との合い具合で決まります。広告費で順番が変わることはありません。"],
];

export default async function Home() {
  const cats = activeCategories().map((c) => ({ slug: c.slug, name: c.name, description: c.description }));
  const areas = activeAreas();
  const user = await getCurrentUser();
  const ongoing = user?.role === "customer" ? projectsForCustomer(user.id).filter((p) => !["completed", "cancelled"].includes(p.status)) : [];
  const works = all<{ id: string; title: string; cost_label: string; image_url: string | null; file_id: string | null; company: string }>(
    `SELECT w.id, w.title, w.cost_label, w.image_url, w.file_id, c.name AS company FROM company_works w JOIN companies c ON c.id = w.company_id
      WHERE c.status = 'approved' AND ${demoVisibleSql("c.")} ORDER BY w.created_at DESC, w.id LIMIT 8`,
  );
  const stats = get<{ n: number; rating: number }>(`SELECT COUNT(*) n, AVG(rating_avg) rating FROM companies WHERE status = 'approved' AND ${demoVisibleSql()}`);
  return (
    <>
      <Track kind="visit" />
      {/* 1. The question, next to a photo of a finished room (photo only on wide screens) */}
      <section className="grid items-start gap-10 pb-16 pt-2 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-14 lg:pb-24">
        <div className="relative hidden lg:sticky lg:top-24 lg:block">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-soft shadow-[var(--shadow-pop)]">
            <ImageTag />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_PHOTO} alt="リビングの内装リフォームのイメージ" className="size-full object-cover" />
          </div>
          <div className="absolute -bottom-6 left-6 right-16 rounded-2xl bg-surface/95 p-5 shadow-[var(--shadow-lift)] backdrop-blur">
            <div className="flex items-baseline gap-6">
              <div>
                <div className="tnum text-[28px] font-semibold leading-none">★ {(stats?.rating ?? 0).toFixed(1)}</div>
                <div className="mt-1.5 text-[13px] text-muted">掲載会社の平均評価</div>
              </div>
              <div>
                <div className="tnum text-[28px] font-semibold leading-none">{stats?.n ?? 0}社</div>
                <div className="mt-1.5 text-[13px] text-muted">審査済みの会社</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[560px] lg:pt-6">
          {ongoing.length > 0 && (
            <Link href="/projects" className="lift mb-8 flex min-h-14 items-center justify-between rounded-2xl bg-brand-soft px-5">
              <span className="text-[15px] font-medium text-brand">進行中の相談 {ongoing.length}件</span>
              <Icon name="chevron-right" size={18} className="text-brand" />
            </Link>
          )}
          <Kicker>住まいの工事を、迷わず相談</Kicker>
          <h1 className="jp mt-3 text-[44px] font-bold leading-[1.15] tracking-tight sm:text-[60px]">どんな工事？</h1>
          <p className="mt-3 text-[16px] text-muted">答えるだけで、合う会社が見つかります。無料・営業電話なし。</p>
          <div className="mt-8">
            <CategoryPicker featured={cats.slice(0, FEATURED)} more={cats.slice(FEATURED)} withTabBar={user?.role === "customer"} />
          </div>
        </div>
      </section>

      {/* 2. Real work, big */}
      {works.length > 0 && (
        <section className="bleed bg-surface py-14 sm:py-20">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-10 lg:px-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Kicker className="mb-2">掲載会社の実績から</Kicker>
                <h2 className="text-[26px] font-bold sm:text-[32px]">最近の施工事例</h2>
              </div>
            </div>
          </div>
          <div className="no-scrollbar mx-auto mt-7 flex max-w-[1320px] snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:scroll-px-10 sm:px-10 lg:px-12 lg:grid lg:grid-cols-4 lg:overflow-visible lg:[&>*:nth-child(n+5)]:hidden">
            {works.map((w) => (
              <figure key={w.id} className="w-[72vw] max-w-[300px] shrink-0 snap-start lg:w-auto lg:max-w-none">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-soft">
                  <SampleTag />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={workImage(w) ?? ""} alt={w.title} className="size-full object-cover" loading="lazy" />
                </div>
                <figcaption className="mt-3">
                  <div className="truncate text-[15px] font-medium">{w.title}</div>
                  <div className="mt-0.5 flex justify-between gap-3 text-[13px] text-muted">
                    <span className="truncate">{w.company}</span>
                    <span className="tnum shrink-0 text-ink-2">{w.cost_label}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 3. How it works, on soft green */}
      <section className="bleed bg-brand-soft py-14 sm:py-20">
        <div className="mx-auto max-w-[1320px] px-5 sm:px-10 lg:px-12">
          <Kicker className="mb-2">4つ答えて、1社ずつ</Kicker>
          <h2 className="text-[26px] font-bold text-brand-ink sm:text-[32px]">使い方</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map(([t, d], i) => (
              <li key={t} className="rounded-[24px] bg-surface p-6 shadow-[var(--shadow-card)]">
                <span className="tnum text-[40px] font-semibold leading-none text-brand-2">{i + 1}</span>
                <div className="mt-4 text-[18px] font-semibold">{t}</div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Trust, beside a facade */}
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seed/exterior-2.jpg" alt="外壁塗装のイメージ" className="size-full object-cover" loading="lazy" />
          <ImageTag />
        </div>
        <div>
          <Kicker className="mb-2">条件に合う会社だけ</Kicker>
          <h2 className="text-[26px] font-bold sm:text-[32px]">安心して使える理由</h2>
          <dl className="mt-8 divide-y divide-line border-y border-line">
            {reasons.map(([t, d]) => (
              <div key={t} className="py-5">
                <dt className="text-[17px] font-semibold">{t}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 5. FAQ on white */}
      <section className="bleed bg-surface py-14 sm:py-20">
        <div className="mx-auto max-w-[720px] px-5 sm:px-8">
          <h2 className="text-[26px] font-bold sm:text-[32px]">よくある質問</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faq.map(([q, a]) => (
              <details key={q} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-soft text-[18px] text-ink-2 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-[14px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 pt-10 text-[13px] text-muted sm:flex-row sm:justify-between">
        <span>対応エリア：{areas.map((a) => a.city).join("・")}</span>
        <Link href="/business" className="inline-flex min-h-11 items-center hover:text-ink">
          施工会社の方
        </Link>
      </footer>
    </>
  );
}
