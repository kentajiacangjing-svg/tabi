import Link from "next/link";
import { all } from "@/lib/db";
import { getSetting } from "@/lib/queries";
import { Icon } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "SUMATCH for Business — 新規営業を、もっと楽に。" };
export const dynamic = "force-dynamic";

const features = [
  { icon: "inbox", title: "対応したい案件だけ選べる", body: "地域・カテゴリ・予算・写真を見て「対応したい」か「見送る」を選ぶだけ。お客様も希望した時だけマッチします。" },
  { icon: "chat", title: "チャット・見積もり・契約がひとつに", body: "LINEのように使えるチャットで相談し、見積書もそのまま提出。比較・決定まで同じ画面で完結します。" },
  { icon: "bell", title: "毎日開かなくていい", body: "新しい案件やお客様からのメッセージはメールとブラウザ通知でお知らせ。必要な時だけ開けばOKです。" },
  { icon: "shield", title: "順位は条件の合い具合だけ", body: "表示順は地域・予算・実績などのマッチ度で決まります。広告費やプランで順位を買うことはできません。" },
];

export default function BusinessLanding() {
  const plans = all<Plan>("SELECT * FROM plans WHERE active = 1 ORDER BY sort");
  const trialDays = Number(getSetting("default_trial_days", "60"));
  const feeNote = getSetting("success_fee_note", "");
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-24">
        <div className="max-w-2xl">
          <div className="text-[12px] font-bold tracking-[0.2em] text-brand">SUMATCH FOR BUSINESS</div>
          <h1 className="mt-3 text-[38px] font-extrabold leading-[1.15] tracking-tight sm:text-[56px]">
            新規営業を、
            <br />
            もっと楽に。
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
            「工事を頼みたい」お客様と、対応できる会社だけをつなぐマッチングサービスです。相見積もりの電話合戦ではなく、条件の合うお客様とじっくり話せます。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/business/signup" className={buttonClass("dark", "lg")}>
              無料で企業登録する
            </Link>
            <Link href="/login?next=/business/dashboard" className={buttonClass("secondary", "lg")}>
              ログイン
            </Link>
          </div>
          {trialDays > 0 && <p className="mt-4 text-[13px] text-muted">初期登録の企業様は{trialDays}日間の無料期間つき</p>}
        </div>
      </section>

      <section className="border-y border-line bg-soft/50 py-16">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-3xl border border-line bg-white p-6">
              <Icon name={f.icon} size={24} className="text-brand" />
              <div className="mt-5 text-lg font-bold">{f.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="pricing">
        <h2 className="text-[28px] font-bold tracking-tight sm:text-4xl">料金プラン</h2>
        <p className="mt-3 text-muted">マッチ（お客様と双方合意してチャットが始まった件数）に応じたシンプルな月額制です。</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p, i) => (
            <div key={p.id} className={cx("flex flex-col rounded-3xl border p-6", i === 1 ? "border-ink bg-ink text-white" : "border-line bg-white")}>
              <div className="text-[13px] font-bold tracking-wider">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[36px] font-extrabold tracking-tight">{p.monthly_price.toLocaleString()}</span>
                <span className={cx("text-sm", i === 1 ? "text-white/60" : "text-muted")}>円 / 月（税別）</span>
              </div>
              <div className="mt-1 font-semibold">月{p.match_limit}マッチまで</div>
              <p className={cx("mt-3 text-sm", i === 1 ? "text-white/70" : "text-muted")}>{p.description}</p>
              <ul className={cx("mt-5 space-y-2 text-sm", i === 1 ? "text-white/85" : "text-ink-2")}>
                <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0" />案件の閲覧・チャット・見積もり提出</li>
                <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0" />企業プロフィール・施工事例の掲載</li>
                <li className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0" />成約時 成功報酬 {Math.round(p.success_fee_rate * 1000) / 10}%</li>
              </ul>
              <Link href={`/business/signup?plan=${p.code}`} className={buttonClass(i === 1 ? "primary" : "secondary", "md", "mt-6")}>
                このプランで始める
              </Link>
            </div>
          ))}
        </div>
        {feeNote && <p className="mt-4 text-[13px] text-muted">{feeNote}</p>}
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 rounded-[28px] border border-line bg-soft/60 p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
          <div>
            <div className="text-[12px] font-bold tracking-[0.2em] text-muted">COMING SOON</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">SUMATCH Web</div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              自社サイトがない・古いままの会社さま向けに、施工事例が映えるWebサイト制作をご用意しています。登録企業にはSUMATCH上の簡易企業ページが自動で作られます。※ Web制作のご利用有無はマッチングの順位に影響しません。
            </p>
          </div>
          <Link href="/business/signup" className={buttonClass("secondary", "md")}>まずは企業登録</Link>
        </div>
      </section>
    </main>
  );
}
