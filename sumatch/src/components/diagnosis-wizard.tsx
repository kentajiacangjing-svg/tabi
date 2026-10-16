"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitDiagnosisAction } from "@/app/actions/customer";
import { estimateRange } from "@/lib/estimate";
import { BUDGETS, HOUSE_CHOICES, MAX_PROJECT_PHOTOS, TIMINGS } from "@/lib/constants";
import { manRange } from "@/lib/format";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, Textarea, cx } from "./ui";

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
  postal_code: string;
  prefecture: string;
  city: string;
  house_type: string;
  details: string;
  budget: string;
  desired_timing: string;
}

const EMPTY: Draft = { category_id: "", postal_code: "", prefecture: "神奈川県", city: "", house_type: "", details: "", budget: "", desired_timing: "" };

// One screen, one decision. "category" is answered on the top page; it is shown only if missing.
type Step = "category" | "budget" | "timing" | "area" | "house" | "photos" | "confirm" | "account";
const QUESTIONS: Step[] = ["budget", "timing", "area", "house", "photos", "confirm"];
const STORAGE_KEY = "sumatch:diagnosis:v2";

async function shrinkImage(file: File): Promise<File> {
  // Downscale large photos on-device so uploads stay fast on mobile networks.
  if (file.size < 1.2 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

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
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
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
      setStep(same && restored!.step !== "account" ? restored!.step : "budget");
    } else if (restored?.d.category_id) {
      setD({ ...EMPTY, ...restored.d });
      setStep(restored.step === "account" ? "confirm" : restored.step);
    } else {
      setStep("category");
    }
    setHydrated(true);
  }, [categories, initialCategory]);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ d, step }));
  }, [d, step, hydrated]);

  const category = categories.find((c) => c.id === d.category_id);
  const cities = areas.filter((a) => a.prefecture === d.prefecture);
  const inArea = areas.some((a) => a.prefecture === d.prefecture && a.city === d.city);
  const qIndex = QUESTIONS.indexOf(step);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const next = () => go(QUESTIONS[qIndex + 1] ?? "confirm");
  const back = () => {
    if (step === "account") return go("confirm");
    if (step === "category") return router.push("/");
    if (qIndex <= 0) return initialCategory ? router.push("/") : go("category");
    go(QUESTIONS[qIndex - 1]);
  };
  const choose = <K extends keyof Draft>(k: K, v: Draft[K], after?: Step) => {
    setD((x) => ({ ...x, [k]: v }));
    setTimeout(() => (after ? go(after) : next()), 140); // let the selected state register before moving on
  };

  const onPostal = (v: string) => {
    const z = v.replace(/[^\d-]/g, "").slice(0, 8);
    const digits = z.replace("-", "");
    const hit = digits.length >= 3 ? areas.find((a) => a.postal_prefixes.split(",").includes(digits.slice(0, 3))) : undefined;
    setD((x) => ({ ...x, postal_code: z, ...(hit ? { prefecture: hit.prefecture, city: hit.city } : {}) }));
    if (hit) setOtherCity(false);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PROJECT_PHOTOS - photos.length);
    const shrunk = await Promise.all(list.map(shrinkImage));
    setPhotos((p) => [...p, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const submit = (fd: FormData) => {
    setError(null);
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => fd.set(k, d[k].trim()));
    fd.set("contact_time", "");
    fd.set("concerns", "");
    photos.forEach((p) => fd.append("photos", p.file));
    start(async () => {
      const r = await submitDiagnosisAction(fd);
      if (!r.ok) return setError(r.error);
      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/matches?project=${r.projectId}`);
      router.refresh();
    });
  };

  const estimate = category ? estimateRange({ priceMin: category.price_min, priceMax: category.price_max, houseType: d.house_type, buildingAge: null }) : null;

  if (!hydrated) return <div className="min-h-[60dvh]" />;

  return (
    <div className="mx-auto min-h-[70dvh] max-w-[680px]">
      <div className="mb-10 flex min-h-11 items-center justify-between">
        <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-[15px] text-muted hover:text-ink">
          <Icon name="chevron-left" size={18} />
          戻る
        </button>
        {qIndex >= 0 && (
          <span className="text-[14px] tabular-nums text-muted" aria-label={`${QUESTIONS.length}問中${qIndex + 1}問目`}>
            {qIndex + 1} / {QUESTIONS.length}
          </span>
        )}
      </div>

      <div key={step} className="animate-fade-up">
        {step === "category" && (
          <Question title="どんな工事を|考えていますか？" headingRef={headingRef}>
            <Options options={categories.map((c) => ({ value: c.id, label: c.name, sub: c.description }))} value={d.category_id} onChange={(v) => choose("category_id", v, "budget")} />
          </Question>
        )}

        {step === "budget" && (
          <Question title="予算は|どれくらいですか？" headingRef={headingRef}>
            <Options options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))} value={d.budget} onChange={(v) => choose("budget", v)} />
          </Question>
        )}

        {step === "timing" && (
          <Question title="いつ頃|始めたいですか？" headingRef={headingRef}>
            <Options options={TIMINGS.map((t) => ({ value: t.value, label: t.label }))} value={d.desired_timing} onChange={(v) => choose("desired_timing", v)} />
          </Question>
        )}

        {step === "area" && (
          <Question title="工事をする場所は？" sub="市区町村までで大丈夫です。" headingRef={headingRef}>
            <Options
              options={[...cities.map((c) => ({ value: c.city, label: c.city })), { value: "__other", label: "それ以外の地域" }]}
              value={otherCity ? "__other" : inArea ? d.city : ""}
              onChange={(v) => {
                if (v === "__other") {
                  setOtherCity(true);
                  setD((x) => ({ ...x, city: inArea ? "" : x.city }));
                } else {
                  setOtherCity(false);
                  choose("city", v);
                }
              }}
            />
            {otherCity ? (
              <div className="mt-6 space-y-4">
                <Field label="市区町村">
                  <Input value={d.city} onChange={(e) => setD((x) => ({ ...x, city: e.target.value }))} placeholder="例：鎌倉市" autoFocus />
                </Field>
                <p className="text-[14px] leading-relaxed text-muted">このエリアはまだ準備中です。ご相談は保存し、対応できる会社が見つかり次第お知らせします。</p>
                <Button size="lg" className="w-full" disabled={!d.city.trim()} onClick={next}>
                  次へ
                </Button>
              </div>
            ) : (
              <details className="mt-8">
                <summary className="flex min-h-11 cursor-pointer list-none items-center text-[15px] text-muted underline-offset-4 hover:underline">郵便番号で選ぶ</summary>
                <Input className="mt-3 max-w-[12rem]" inputMode="numeric" placeholder="251-0052" value={d.postal_code} onChange={(e) => onPostal(e.target.value)} aria-label="郵便番号" autoComplete="postal-code" />
                {inArea && d.postal_code && (
                  <Button className="mt-4" onClick={next}>
                    {d.city}で進む
                  </Button>
                )}
              </details>
            )}
          </Question>
        )}

        {step === "house" && (
          <Question title="お住まいは？" headingRef={headingRef}>
            <Options options={HOUSE_CHOICES.map((h) => ({ value: h, label: h }))} value={d.house_type} onChange={(v) => choose("house_type", v)} />
          </Question>
        )}

        {step === "photos" && (
          <Question title="気になる場所の|写真はありますか？" sub="あると、会社がより具体的に考えられます。なくても進めます。" headingRef={headingRef}>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`追加した写真 ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={`写真${i + 1}を削除`}
                    onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                    className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-md bg-ink/70 text-white"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PROJECT_PHOTOS && (
                <label className="press grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-line bg-surface text-[14px] text-ink-2 focus-within:outline focus-within:outline-2 focus-within:outline-brand hover:border-ink/30">
                  写真を追加
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
            <div className="mt-8">
              <Field label="ひとこと（任意）">
                <Textarea rows={3} value={d.details} onChange={(e) => setD((x) => ({ ...x, details: e.target.value }))} maxLength={2000} placeholder="例：南側の色あせが気になります。屋根も一緒に見てほしいです。" />
              </Field>
            </div>
            <Button size="lg" className="mt-8 w-full" onClick={next}>
              {photos.length ? "次へ" : "写真なしで次へ"}
            </Button>
          </Question>
        )}

        {step === "confirm" && category && (
          <Question title="この条件で探します" headingRef={headingRef}>
            <dl className="border-y border-line">
              <ConfirmRow label="工事" value={category.name} onEdit={() => go("category")} />
              <ConfirmRow label="予算" value={BUDGETS.find((b) => b.value === d.budget)?.label} onEdit={() => go("budget")} />
              <ConfirmRow label="時期" value={TIMINGS.find((t) => t.value === d.desired_timing)?.label} onEdit={() => go("timing")} />
              <ConfirmRow label="場所" value={`${d.prefecture}${d.city}`} onEdit={() => go("area")} />
              <ConfirmRow label="お住まい" value={d.house_type} onEdit={() => go("house")} />
              <ConfirmRow label="写真" value={photos.length ? `${photos.length}枚` : "なし"} onEdit={() => go("photos")} />
            </dl>
            {estimate && (
              <p className="mt-6 text-[15px] leading-relaxed text-ink-2">
                {category.name}の一般的な費用は<span className="font-medium text-ink">約{manRange(estimate.min, estimate.max)}</span>です。正式な金額は現地確認のあとに決まります。
              </p>
            )}
            {wrongRole ? (
              <Notice tone="warn" className="mt-8">
                企業・運営アカウントでログイン中です。相談を作るには<Link href="/login" className="underline">一般ユーザーとしてログイン</Link>してください。
              </Notice>
            ) : loggedIn ? (
              <form action={submit} className="mt-8">
                {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
                <Button size="lg" className="w-full" disabled={pending}>
                  {pending ? "探しています…" : "この条件で会社を探す"}
                </Button>
              </form>
            ) : (
              <Button size="lg" className="mt-8 w-full" onClick={() => go("account")}>
                この条件で会社を探す
              </Button>
            )}
            <p className="mt-4 text-center text-[13px] text-muted">この時点で会社に連絡先が伝わることはありません。</p>
          </Question>
        )}

        {step === "account" && (
          <Question title="最後に、|受け取り先を|教えてください" sub="会社からの返事をお知らせします。電話番号は不要です。" headingRef={headingRef}>
            <form action={submit} className="space-y-5">
              <Field label="お名前（ニックネーム可）">
                <Input name="name" autoComplete="nickname" maxLength={40} required />
              </Field>
              <Field label="メールアドレス" hint="会社には公開されません">
                <Input name="email" type="email" inputMode="email" autoComplete="email" required />
              </Field>
              <Field label="パスワード" hint="8文字以上">
                <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
              </Field>
              {error && <Notice tone="danger">{error}</Notice>}
              <Button size="lg" className="w-full" disabled={pending}>
                {pending ? "探しています…" : "登録して会社を見る"}
              </Button>
              <p className="text-center text-[14px] text-muted">
                登録済みの方は<Link href="/login?next=/diagnosis" className="text-ink underline underline-offset-4">ログイン</Link>
              </p>
            </form>
          </Question>
        )}
      </div>
    </div>
  );
}

function Question({ title, sub, children, headingRef }: { title: string; sub?: string; children: React.ReactNode; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  // "|" in a title marks a preferred line break point.
  const parts = title.split("|");
  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="jp text-[32px] font-semibold leading-[1.3] outline-none sm:text-[38px]">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && <wbr />}
          </span>
        ))}
      </h1>
      {sub && <p className="mt-3 text-[16px] leading-relaxed text-muted">{sub}</p>}
      <div className="mt-10">{children}</div>
    </div>
  );
}

function Options({ options, value, onChange }: { options: { value: string; label: string; sub?: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2.5" role="radiogroup">
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
              "press flex min-h-16 flex-col items-start justify-center rounded-xl border px-5 py-3 text-left",
              on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/30",
            )}
          >
            <span className="text-[18px] font-medium">{o.label}</span>
            {o.sub && <span className={cx("text-[13px]", on ? "text-white/75" : "text-muted")}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmRow({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line last:border-0">
      <dt className="w-20 shrink-0 text-[15px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-[16px]">{value || "—"}</dd>
      <button type="button" onClick={onEdit} className="min-h-11 shrink-0 px-1 text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline" aria-label={`${label}を変更`}>
        変更
      </button>
    </div>
  );
}
