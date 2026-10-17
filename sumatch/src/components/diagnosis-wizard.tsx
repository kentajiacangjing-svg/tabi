"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitDiagnosisAction } from "@/app/actions/customer";
import { estimateRange } from "@/lib/estimate";
import { BUDGETS, TIMINGS } from "@/lib/constants";
import { manRange } from "@/lib/format";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, cx } from "./ui";

export interface WizardCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  price_min: number;
  price_max: number;
  price_note: string;
  concerns: string[];
}

export interface WizardArea {
  prefecture: string;
  city: string;
  postal_prefixes: string;
}

interface Draft {
  category_id: string;
  prefecture: string;
  city: string;
  budget: string;
  desired_timing: string;
}

const EMPTY: Draft = { category_id: "", prefecture: "神奈川県", city: "", budget: "", desired_timing: "" };

// One question per screen. Photos and details are shared later in chat, so we don't ask for them here.
type Step = "category" | "budget" | "timing" | "area" | "confirm" | "account";
const FLOW: Step[] = ["category", "budget", "timing", "area", "confirm"];
const STORAGE_KEY = "sumatch:diagnosis:v3";

export function DiagnosisWizard({
  categories,
  areas,
  loggedIn,
  wrongRole,
  initialCategory,
}: {
  categories: WizardCategory[];
  areas: WizardArea[];
  loggedIn: boolean;
  wrongRole: boolean;
  initialCategory?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("budget");
  const [d, setD] = useState<Draft>(EMPTY);
  const [otherCity, setOtherCity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const init = initialCategory ? categories.find((c) => c.slug === initialCategory) : undefined;
    let restored: { d: Draft; step: Step } | null = null;
    try {
      restored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch {}
    if (init) {
      const same = restored?.d.category_id === init.id;
      setD({ ...EMPTY, ...(same ? restored!.d : {}), category_id: init.id });
      setStep(same && restored!.step !== "account" && restored!.step !== "category" ? restored!.step : "budget");
    } else if (restored?.d.category_id) {
      setD({ ...EMPTY, ...restored.d });
      setStep(restored.step === "account" ? "confirm" : restored.step);
    } else {
      setStep("category");
    }
    setHydrated(true);
  }, [categories, initialCategory]);

  useEffect(() => {
    try {
      if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ d, step }));
    } catch {}
  }, [d, step, hydrated]);

  const category = categories.find((c) => c.id === d.category_id);
  const cities = areas.filter((a) => a.prefecture === d.prefecture);
  const inArea = areas.some((a) => a.prefecture === d.prefecture && a.city === d.city);
  const index = step === "account" ? FLOW.length : FLOW.indexOf(step);
  const progress = Math.min(1, (index + 1) / FLOW.length);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const back = () => {
    if (step === "account") return go("confirm");
    if (index <= 0 || (step === "budget" && initialCategory)) return router.push("/");
    go(FLOW[index - 1]);
  };
  const next = () => go(FLOW[index + 1] ?? "confirm");
  const canNext =
    (step === "category" && !!d.category_id) ||
    (step === "budget" && !!d.budget) ||
    (step === "timing" && !!d.desired_timing) ||
    (step === "area" && !!d.city.trim());

  const submit = (fd: FormData) => {
    setError(null);
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => fd.set(k, d[k].trim()));
    for (const k of ["postal_code", "house_type", "contact_time", "concerns", "details"]) fd.set(k, "");
    start(async () => {
      const r = await submitDiagnosisAction(fd);
      if (!r.ok) return setError(r.error);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      router.push(`/matches?project=${r.projectId}`);
      router.refresh();
    });
  };

  const estimate = category ? estimateRange({ priceMin: category.price_min, priceMax: category.price_max, houseType: "", buildingAge: null }) : null;

  if (!hydrated) return <div className="min-h-[70dvh]" />;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-[640px] flex-col">
      {/* thin progress bar + back */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} className="-ml-2 grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-soft" aria-label="戻る">
          <Icon name="chevron-left" size={22} />
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="進み具合">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div key={step} className="animate-fade-up flex flex-1 flex-col justify-center py-8">
        {step === "category" && (
          <Question title="どんな工事？" headingRef={headingRef}>
            <Options columns options={categories.map((c) => ({ value: c.id, label: c.name, sub: c.description }))} value={d.category_id} onChange={(v) => setD((x) => ({ ...x, category_id: v }))} />
          </Question>
        )}

        {step === "budget" && (
          <Question title="予算は？" headingRef={headingRef}>
            <Options options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))} value={d.budget} onChange={(v) => setD((x) => ({ ...x, budget: v }))} />
          </Question>
        )}

        {step === "timing" && (
          <Question title="いつ頃？" headingRef={headingRef}>
            <Options options={TIMINGS.map((t) => ({ value: t.value, label: t.label }))} value={d.desired_timing} onChange={(v) => setD((x) => ({ ...x, desired_timing: v }))} />
          </Question>
        )}

        {step === "area" && (
          <Question title="場所は？" headingRef={headingRef}>
            <Options
              options={[...cities.map((c) => ({ value: c.city, label: c.city })), { value: "__other", label: "それ以外" }]}
              value={otherCity ? "__other" : inArea ? d.city : ""}
              onChange={(v) => {
                if (v === "__other") {
                  setOtherCity(true);
                  setD((x) => ({ ...x, city: inArea ? "" : x.city }));
                } else {
                  setOtherCity(false);
                  setD((x) => ({ ...x, city: v }));
                }
              }}
            />
            {otherCity && (
              <div className="mt-5 space-y-3">
                <Input value={d.city} onChange={(e) => setD((x) => ({ ...x, city: e.target.value }))} placeholder="市区町村（例：鎌倉市）" aria-label="市区町村" autoFocus />
                <p className="text-[14px] text-muted">準備中のエリアです。会社が見つかり次第お知らせします。</p>
              </div>
            )}
          </Question>
        )}

        {step === "confirm" && category && (
          <Question title="この条件で探します" headingRef={headingRef}>
            <dl className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <ConfirmRow label="工事" value={category.name} onEdit={() => go("category")} />
              <ConfirmRow label="予算" value={BUDGETS.find((b) => b.value === d.budget)?.label} onEdit={() => go("budget")} />
              <ConfirmRow label="時期" value={TIMINGS.find((t) => t.value === d.desired_timing)?.label} onEdit={() => go("timing")} />
              <ConfirmRow label="場所" value={d.city} onEdit={() => go("area")} />
            </dl>
            {estimate && <p className="mt-5 text-[14px] text-muted">目安 約{manRange(estimate.min, estimate.max)}（正式な金額は現地確認後）</p>}
            {wrongRole && (
              <Notice tone="warn" className="mt-6">
                企業・運営アカウントでログイン中です。<Link href="/login" className="underline">一般ユーザーでログイン</Link>してください。
              </Notice>
            )}
          </Question>
        )}

        {step === "account" && (
          <Question title="結果の受け取り先" sub="電話番号はいりません。" headingRef={headingRef}>
            <form id="account-form" action={submit} className="space-y-4">
              <Field label="お名前（ニックネーム可）">
                <Input name="name" autoComplete="nickname" maxLength={40} required />
              </Field>
              <Field label="メールアドレス" hint="会社には公開されません">
                <Input name="email" type="email" inputMode="email" autoComplete="email" required />
              </Field>
              <Field label="パスワード" hint="8文字以上">
                <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              <p className="text-[14px] text-muted">
                登録済みの方は<Link href="/login?next=/diagnosis" className="text-ink underline underline-offset-4">ログイン</Link>
              </p>
            </form>
          </Question>
        )}
      </div>

      {/* one action, always in the same place */}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-canvas/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {error && (
          <Notice tone="danger" className="mb-3">
            {error}
          </Notice>
        )}
        {step === "confirm" ? (
          loggedIn ? (
            <form action={submit}>
              <Button size="lg" className="w-full" disabled={pending || wrongRole}>
                {pending ? "探しています…" : "条件に合う会社を探す"}
              </Button>
            </form>
          ) : (
            <Button size="lg" className="w-full" disabled={wrongRole} onClick={() => go("account")}>
              条件に合う会社を探す
            </Button>
          )
        ) : step === "account" ? (
          <Button size="lg" className="w-full" form="account-form" disabled={pending}>
            {pending ? "探しています…" : "登録して会社を見る"}
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={!canNext} onClick={next}>
            次へ
          </Button>
        )}
      </div>
    </div>
  );
}

function Question({ title, sub, children, headingRef }: { title: string; sub?: string; children: React.ReactNode; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="jp text-[34px] font-semibold leading-tight outline-none sm:text-[42px]">
        {title}
      </h1>
      {sub && <p className="mt-2 text-[15px] text-muted">{sub}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Options({ options, value, onChange, columns }: { options: { value: string; label: string; sub?: string }[]; value: string; onChange: (v: string) => void; columns?: boolean }) {
  return (
    <div className={cx("grid gap-3", columns && "grid-cols-2")} role="radiogroup">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={on}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "press relative flex min-h-[64px] flex-col items-start justify-center rounded-2xl border px-5 py-4 text-left shadow-[var(--shadow-card)]",
              columns && "min-h-[96px]",
              on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/25",
            )}
          >
            <span className="text-[18px] font-medium leading-snug">{o.label}</span>
            {o.sub && <span className={cx("mt-0.5 text-[13px] leading-snug", on ? "text-white/75" : "text-muted")}>{o.sub}</span>}
            {on && (
              <span className="absolute right-4 top-4" aria-hidden="true">
                <Icon name="check" size={18} strokeWidth={2.4} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmRow({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-line px-5 last:border-0">
      <dt className="w-12 shrink-0 text-[14px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-[17px]">{value || "—"}</dd>
      <button type="button" onClick={onEdit} className="min-h-11 shrink-0 px-1 text-[14px] text-brand" aria-label={`${label}を変更`}>
        変更
      </button>
    </div>
  );
}
