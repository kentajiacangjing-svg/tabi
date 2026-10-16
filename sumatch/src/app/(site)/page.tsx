import Link from "next/link";
import { activeAreas, allCategories } from "@/lib/queries";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Icon } from "@/components/icons";
import { CompanyAvatar } from "@/components/brand";
import { Track } from "@/components/track";
import { buttonClass, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const steps = [
  { n: "01", title: "無料相談", body: "カテゴリ・地域・ご予算などを選ぶだけ。参考相場もその場でわかります。", icon: "chat" },
  { n: "02", title: "最大3社とマッチ", body: "条件に合う会社から、話したい会社を選びます。会社側も対応したい時だけマッチ成立。", icon: "users" },
  { n: "03", title: "見積もり比較", body: "SUMATCH内のチャットで相談し、届いた見積もりを横並びで比較。", icon: "compare" },
  { n: "04", title: "会社を決定", body: "納得できた1社を選ぶだけ。断りの連絡もSUMATCHがお伝えします。", icon: "check" },
  { n: "05", title: "契約・工事", body: "契約内容や工事の進み具合も、SUMATCHでまとめて管理できます。", icon: "shield" },
];

const promises = [
  { icon: "phone-off", title: "電話番号の登録は不要", body: "連絡はすべてSUMATCH内のメッセージ。突然の営業電話はありません。" },
  { icon: "users", title: "話すのは最大3社だけ", body: "あなたが「話したい」と選び、会社も「対応したい」時だけつながります。" },
  { icon: "lock", title: "やり取りが記録に残る", body: "見積もり・約束ごとがすべて残るので、言った言わないを防げます。" },
];

export default function Home() {
  const categories = allCategories();
  const areas = activeAreas();
  return (
    <>
      <Track kind="visit" />
      <SiteHeader />
      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-20">
            <div className="animate-fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px] font-medium text-muted">
                <span className="size-1.5 rounded-full bg-ok" />
                湘南エリア（{areas.map((a) => a.city).join("・")}）で先行スタート
              </div>
              <h1 className="text-[40px] font-extrabold leading-[1.15] tracking-tight sm:text-[56px]">
                探す・比べる・
                <br />
                決めるを、
                <br />
                ひとつに。
              </h1>
              <p className="mt-5 text-lg font-semibold text-ink-2 sm:text-xl">家の困りごとを、無料で相談。</p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
                営業電話だらけにならない。
                <br />
                条件に合う会社だけ、比較できます。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/diagnosis" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
                  無料で相談する
                  <Icon name="chevron-right" size={18} />
                </Link>
                <span className="text-center text-[13px] text-muted sm:text-left">約2分・電話番号の入力なし</span>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* ---------------- Promises ---------------- */}
        <section className="border-y border-line bg-soft/50">
          <div className="mx-auto grid max-w-6xl gap-px px-4 py-10 sm:grid-cols-3 sm:px-6">
            {promises.map((p) => (
              <div key={p.title} className="flex gap-4 py-3 sm:px-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-[var(--shadow-card)]">
                  <Icon name={p.icon} size={21} />
                </div>
                <div>
                  <div className="font-bold">{p.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-muted">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" id="how">
          <div className="text-[12px] font-bold tracking-[0.2em] text-brand">HOW IT WORKS</div>
          <h2 className="mt-2 text-[28px] font-bold tracking-tight sm:text-4xl">相談から契約まで、ここだけで。</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-faint">{s.n}</span>
                  <Icon name={s.icon} size={20} className="text-brand" />
                </div>
                <div className="mt-6 text-[17px] font-bold">{s.title}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------- Categories ---------------- */}
        <section className="bg-soft/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-[28px] font-bold tracking-tight sm:text-4xl">相談できること</h2>
            <p className="mt-3 text-muted">住まいから始めて、暮らしのサービスへ広げていきます。</p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={c.active ? `/diagnosis?category=${c.slug}` : "#"}
                  aria-disabled={!c.active}
                  className={cx(
                    "group rounded-2xl border border-line bg-white p-4 transition-colors",
                    c.active ? "hover:border-ink/20" : "pointer-events-none opacity-55",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon name={c.icon} size={22} className={c.active ? "text-ink" : "text-faint"} />
                    {!c.active && <span className="text-[11px] font-semibold text-faint">まもなく</span>}
                  </div>
                  <div className="mt-5 font-bold">{c.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{c.description}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Compare preview ---------------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <div className="text-[12px] font-bold tracking-[0.2em] text-brand">COMPARE</div>
            <h2 className="mt-2 text-[28px] font-bold tracking-tight sm:text-4xl">金額だけで決めない。</h2>
            <p className="mt-4 leading-relaxed text-muted">
              保証期間・工期・材料・追加費用の条件まで、見積もりを横並びで比較。気になる点はそのままチャットで確認できます。
            </p>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              {["見積もりは会社がSUMATCH上で提出", "保証・工期・追加費用をひと目で比較", "比較のポイントをコメントでお知らせ"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Icon name="check" size={18} className="text-ok" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ComparePreview />
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-[28px] bg-ink px-6 py-14 text-center text-white sm:py-16">
            <h2 className="text-[26px] font-bold tracking-tight sm:text-4xl">まずは、相場を知るところから。</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/70">相談は無料。会社とつながるかどうかは、あなたが決められます。</p>
            <Link href="/diagnosis" className={buttonClass("primary", "lg", "mt-8")}>
              無料で相談する
            </Link>
            <div className="mt-6 text-[13px] text-white/50">
              工事会社の方は <Link href="/business" className="underline underline-offset-4 hover:text-white">こちら</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function HeroPreview() {
  const rows = [
    { name: "湘南ペイント", color: "#2557D6", score: 94, reasons: ["対応地域", "希望予算帯", "外壁実績多数"], state: "チャット中" },
    { name: "藤沢リフォーム", color: "#2F6F5E", score: 89, reasons: ["対応地域", "希望時期対応可能"], state: "見積もり到着" },
    { name: "HOME WORKS", color: "#3B3F46", score: 85, reasons: ["対応地域", "希望予算帯"], state: "見積もり到着" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm md:max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-brand-soft/60 blur-2xl" />
      <div className="rounded-[28px] border border-line bg-white p-4 shadow-[var(--shadow-pop)] sm:p-5">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[12px] text-muted">藤沢市・戸建て・築18年</div>
            <div className="font-bold">外壁塗装の相談</div>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-ink">比較中</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <CompanyAvatar name={r.name} color={r.color} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{r.name}</span>
                  <span className="text-[12px] font-bold text-brand">マッチ度 {r.score}%</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">
                  {r.reasons.map((x) => (
                    <span key={x}>✓ {x}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-soft px-3.5 py-3 text-[12px] text-ink-2">
          <Icon name="lock" size={15} className="text-muted" />
          連絡先を公開せずに、SUMATCH内でやり取りできます
        </div>
      </div>
    </div>
  );
}

function ComparePreview() {
  const cols = [
    { name: "A社", total: "118万円", warranty: "10年", days: "14日", tag: "最安" },
    { name: "B社", total: "132万円", warranty: "15年", days: "16日", tag: "保証が長い" },
    { name: "C社", total: "145万円", warranty: "12年", days: "18日", tag: "" },
  ];
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-[var(--shadow-pop)]">
      <div className="grid grid-cols-[84px_repeat(3,1fr)] text-sm">
        <div className="bg-soft/70 p-3" />
        {cols.map((c) => (
          <div key={c.name} className="bg-soft/70 p-3 text-center font-bold">
            {c.name}
          </div>
        ))}
        {(
          [
            ["金額", "total"],
            ["保証", "warranty"],
            ["工期", "days"],
          ] as const
        ).map(([label, key]) => (
          <div key={key} className="contents">
            <div className="border-t border-line p-3 text-[12px] text-muted">{label}</div>
            {cols.map((c) => (
              <div key={c.name} className={cx("border-t border-line p-3 text-center", key === "total" && "text-[15px] font-bold")}>
                {c[key]}
              </div>
            ))}
          </div>
        ))}
        <div className="border-t border-line p-3 text-[12px] text-muted">ポイント</div>
        {cols.map((c) => (
          <div key={c.name} className="border-t border-line p-3 text-center">
            {c.tag && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">{c.tag}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
