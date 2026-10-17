import Link from "next/link";
import { activeAreas, activeCategories, projectsForCustomer } from "@/lib/queries";
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
  ["見積を取ったら断れますか？", "断れます。「この会社に決める」を押さない限り、契約にはなりません。他社へのお断りもSUMATCHからお伝えします。"],
  ["どの地域で使えますか？", "いまは神奈川県の湘南エリア（藤沢市・茅ヶ崎市・平塚市）から始めています。"],
  ["表示される会社の順番は？", "地域・予算・実績・口コミなど、ご相談との合い具合で決まります。広告費で順番が変わることはありません。"],
];

export default async function Home() {
  const cats = activeCategories().map((c) => ({ slug: c.slug, name: c.name, description: c.description }));
  const areas = activeAreas();
  const user = await getCurrentUser();
  const ongoing = user?.role === "customer" ? projectsForCustomer(user.id).filter((p) => !["completed", "cancelled"].includes(p.status)) : [];
  return (
    <>
      <Track kind="visit" />
      <section className="mx-auto max-w-[560px] pb-20 pt-4 sm:pt-12">
        {ongoing.length > 0 && (
          <Link href="/projects" className="mb-10 flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-5 shadow-[var(--shadow-card)]">
            <span className="text-[15px]">進行中の相談 {ongoing.length}件</span>
            <span className="text-[14px] text-brand">見る</span>
          </Link>
        )}
        <h1 className="jp text-[40px] font-semibold leading-[1.2] sm:text-[52px]">どんな工事？</h1>
        <p className="mt-3 text-[16px] text-muted">答えるだけで、合う会社が見つかります。無料・営業電話なし。</p>
        <div className="mt-10">
          <CategoryPicker featured={cats.slice(0, FEATURED)} more={cats.slice(FEATURED)} />
        </div>
      </section>

      <div className="mx-auto max-w-[560px] space-y-20 border-t border-line pb-10 pt-16 sm:space-y-24">
        <section>
          <h2 className="text-[24px] font-semibold">使い方</h2>
          <ol className="mt-6 space-y-6">
            {steps.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.25rem_1fr]">
                <span className="text-[20px] font-medium text-brand">{i + 1}</span>
                <div>
                  <div className="text-[17px] font-medium">{t}</div>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-[24px] font-semibold">安心して使える理由</h2>
          <dl className="mt-6 space-y-5">
            {reasons.map(([t, d]) => (
              <div key={t}>
                <dt className="text-[17px] font-medium">{t}</dt>
                <dd className="mt-0.5 text-[14px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-[24px] font-semibold">よくある質問</h2>
          <div className="mt-4 divide-y divide-line">
            {faq.map(([q, a]) => (
              <details key={q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[16px]">
                  {q}
                  <span className="text-[20px] text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-[14px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 text-[13px] text-muted sm:flex-row sm:justify-between">
          <span>対応エリア：{areas.map((a) => a.city).join("・")}</span>
          <Link href="/business" className="hover:text-ink">
            施工会社の方
          </Link>
        </footer>
      </div>
    </>
  );
}
