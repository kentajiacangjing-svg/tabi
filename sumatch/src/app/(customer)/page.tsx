import Link from "next/link";
import { activeAreas, activeCategories } from "@/lib/queries";
import { CategoryPicker } from "@/components/category-picker";
import { Track } from "@/components/track";

export const dynamic = "force-dynamic";

const FEATURED = 4;

const steps = [
  ["条件を選ぶ", "工事の種類、予算、時期、場所。数回タップするだけです。"],
  ["会社を1社ずつ見る", "施工写真と口コミを見て、話してみたい会社にだけ「相談する」。"],
  ["比べて、決める", "見積もりは保証や工期も並べて比較。断りの連絡はSUMATCHから伝えます。"],
];

const reasons = [
  ["電話番号はいりません", "やり取りはすべてSUMATCHのメッセージで。知らない番号から電話がかかってくることはありません。"],
  ["話すのは、選んだ会社だけ", "あなたが「相談する」と選び、会社も「対応したい」と答えた時だけ、会話が始まります。"],
  ["約束が記録に残る", "見積もりや工事の約束はすべて残るので、あとから確認できます。"],
];

const faq = [
  ["本当に無料ですか？", "はい。相談・見積もり・比較まで、ご利用者さまの費用はかかりません。会社からの紹介料で運営しています。"],
  ["見積もりを取ったら断れますか？", "断れます。「この会社に決める」を押さない限り、契約にはなりません。他社へのお断りもSUMATCHからお伝えします。"],
  ["どの地域で使えますか？", "いまは神奈川県の湘南エリア（藤沢市・茅ヶ崎市・平塚市）から始めています。"],
  ["表示される会社の順番は？", "地域・予算・実績・口コミなど、ご相談との合い具合で決まります。広告費で順番が変わることはありません。"],
];

export default function Home() {
  const cats = activeCategories().map((c) => ({ slug: c.slug, name: c.name, description: c.description }));
  const areas = activeAreas();
  return (
    <>
      <Track kind="visit" />
      <section className="mx-auto max-w-[720px] pb-16 pt-6 sm:pt-16">
        <h1 className="jp text-[34px] font-semibold leading-[1.3] sm:text-[44px]">
          どんな工事を<wbr />
          考えていますか？
        </h1>
        <p className="mt-3 text-[17px] text-muted">無料・営業電話なし</p>
        <div className="mt-10">
          <CategoryPicker featured={cats.slice(0, FEATURED)} more={cats.slice(FEATURED)} />
        </div>
      </section>

      <div className="mx-auto max-w-[720px] space-y-20 border-t border-line pb-10 pt-16 sm:space-y-28 sm:pt-24">
        <section>
          <h2 className="text-[26px] font-semibold">なぜSUMATCHなのか</h2>
          <p className="mt-4 text-[17px] leading-[1.9] text-ink-2">
            一括見積もりに登録したら、電話が鳴りやまなかった。そんな経験をなくしたくて作りました。
            条件の合う会社だけをご紹介し、話す相手はあなたが選びます。
          </p>
        </section>

        <section>
          <h2 className="text-[26px] font-semibold">使い方</h2>
          <ol className="mt-6 space-y-7">
            {steps.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr]">
                <span className="text-[22px] font-medium text-brand">{i + 1}</span>
                <div>
                  <div className="text-[18px] font-medium">{t}</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-[26px] font-semibold">安心して使える理由</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {reasons.map(([t, d]) => (
              <div key={t} className="py-5">
                <dt className="text-[17px] font-medium">{t}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-[26px] font-semibold">よくある質問</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faq.map(([q, a]) => (
              <details key={q} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium">
                  {q}
                  <span className="text-[20px] font-normal text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 text-[14px] text-muted sm:flex-row sm:justify-between">
          <span>対応エリア：{areas.map((a) => a.city).join("・")}</span>
          <Link href="/business" className="underline-offset-4 hover:text-ink hover:underline">
            施工会社の方はこちら
          </Link>
        </footer>
      </div>
    </>
  );
}
