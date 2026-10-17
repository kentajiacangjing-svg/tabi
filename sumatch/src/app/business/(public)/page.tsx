import Link from "next/link";
import { all } from "@/lib/db";
import { getSetting } from "@/lib/queries";
import { buttonClass } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "SUMATCH for Business" };
export const dynamic = "force-dynamic";

const points = [
  ["相談を1件ずつ見て、選ぶだけ", "地域・予算・時期・写真を見て「対応したい」か「見送る」。お客様も選んだ時だけ、メッセージが始まります。"],
  ["毎日開かなくていい", "新しい相談やお客様からのメッセージは、メールとブラウザ通知でお知らせします。"],
  ["見積から契約まで、ここで", "見積はそのままお客様の比較画面へ。決まった後の契約内容もSUMATCHに残ります。"],
  ["順番はお金で買えません", "紹介の順番は地域・予算・実績・口コミとの合い具合だけで決まります。プランやWeb制作の利用は関係ありません。"],
];

export default function BusinessLanding() {
  const plans = all<Plan>("SELECT * FROM plans WHERE active = 1 ORDER BY sort");
  const trialDays = Number(getSetting("default_trial_days", "60"));
  return (
    <main className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14">
      <section className="max-w-[720px] pb-20 pt-14 sm:pt-24">
        <p className="text-[15px] text-muted">施工会社の方へ</p>
        <h1 className="jp mt-3 text-[36px] font-semibold leading-[1.3] sm:text-[48px]">
          条件の合うお客様と、<wbr />
          じっくり話せる。
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">相見積の電話合戦ではなく、あなたの会社を選んだお客様とだけ相談が始まります。</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/business/signup" className={buttonClass("primary", "lg")}>
            企業登録をはじめる
          </Link>
          {trialDays > 0 && <span className="text-[15px] text-muted">はじめの{trialDays}日間は無料です</span>}
        </div>
      </section>

      <section className="border-t border-line py-16 sm:py-24">
        <dl className="grid gap-x-16 gap-y-10 sm:grid-cols-2">
          {points.map(([t, d]) => (
            <div key={t}>
              <dt className="text-[19px] font-medium">{t}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-line py-16 sm:py-24" id="pricing">
        <h2 className="text-[28px] font-semibold">料金</h2>
        <p className="mt-3 text-[15px] text-muted">お客様と双方が合意してメッセージが始まった件数（マッチ）に応じた月額制です。</p>
        <div className="mt-10 grid divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {plans.map((p) => (
            <div key={p.id} className="py-8 sm:px-8 sm:first:pl-0 sm:last:pr-0">
              <div className="text-[14px] tracking-[0.12em] text-muted">{p.name}</div>
              <div className="mt-3 text-[34px] font-medium tracking-tight">
                ¥{p.monthly_price.toLocaleString()}
                <span className="ml-1 text-[14px] font-normal text-muted">/ 月・税別</span>
              </div>
              <div className="mt-2 text-[16px]">月{p.match_limit}件までマッチ</div>
              <div className="mt-1 text-[14px] text-muted">成約時 {Math.round(p.success_fee_rate * 1000) / 10}%</div>
              <p className="mt-4 text-[14px] text-muted">{p.description}</p>
            </div>
          ))}
        </div>
        <Link href="/business/signup" className={buttonClass("primary", "lg", "mt-12")}>
          企業登録をはじめる
        </Link>
      </section>

      <section className="border-t border-line py-16">
        <h2 className="text-[20px] font-medium">自社サイトについて</h2>
        <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-muted">
          登録すると、SUMATCHの中に会社のページが自動でできます。施工事例を伝える自社サイトを作りたい場合は「SUMATCH Web」もご相談いただけます（ご利用の有無は紹介の順番に影響しません）。
        </p>
      </section>
    </main>
  );
}
