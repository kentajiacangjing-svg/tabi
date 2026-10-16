"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitDiagnosisAction } from "@/app/actions/customer";
import { estimateRange } from "@/lib/estimate";
import { BUDGETS, CONTACT_TIMES, HOUSE_TYPES, MAX_PROJECT_PHOTOS, PREFECTURES, TIMINGS } from "@/lib/constants";
import { manRange } from "@/lib/format";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, Select, Textarea, cx } from "./ui";

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
  building_age: string;
  concerns: string[];
  details: string;
  budget: string;
  desired_timing: string;
  contact_time: string;
}

const EMPTY: Draft = {
  category_id: "",
  postal_code: "",
  prefecture: "神奈川県",
  city: "",
  house_type: "",
  building_age: "",
  concerns: [],
  details: "",
  budget: "",
  desired_timing: "",
  contact_time: "",
};

const STEPS = ["カテゴリ", "地域", "お住まい", "工事内容", "予算", "希望時期", "写真", "診断結果"] as const;
const STORAGE_KEY = "sumatch:diagnosis";

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
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
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
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Restore an unfinished draft (photos are not persisted).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const init = initialCategory ? categories.find((c) => c.slug === initialCategory) : undefined;
      if (saved) {
        const parsed = JSON.parse(saved) as { d: Draft; step: number };
        setD({ ...EMPTY, ...parsed.d, ...(init ? { category_id: init.id } : {}) });
        setStep(Math.min(parsed.step, STEPS.length - 2));
      } else if (init) {
        setD((x) => ({ ...x, category_id: init.id }));
        setStep(1);
      }
    } catch {}
    setHydrated(true);
  }, [categories, initialCategory]);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ d, step }));
  }, [d, step, hydrated]);

  const category = categories.find((c) => c.id === d.category_id);
  const prefectures = useMemo<string[]>(() => [...new Set(areas.map((a) => a.prefecture))], [areas]);
  const cities = areas.filter((a) => a.prefecture === d.prefecture);
  const inArea = areas.some((a) => a.prefecture === d.prefecture && a.city === d.city);

  const estimate = category
    ? estimateRange({
        priceMin: category.price_min,
        priceMax: category.price_max,
        houseType: d.house_type,
        buildingAge: d.building_age === "" ? null : Number(d.building_age),
      })
    : null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const canNext = [
    !!d.category_id,
    !!d.prefecture && !!d.city && /^(\d{3}-?\d{4})?$/.test(d.postal_code),
    !!d.house_type,
    d.concerns.length > 0 || d.details.trim().length > 0,
    !!d.budget,
    !!d.desired_timing,
    true,
    true,
  ][step];

  const go = (n: number) => {
    setError(null);
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onPostal = (v: string) => {
    const z = v.replace(/[^\d-]/g, "").slice(0, 8);
    set("postal_code", z);
    const digits = z.replace("-", "");
    if (digits.length >= 3) {
      const hit = areas.find((a) => a.postal_prefixes.split(",").includes(digits.slice(0, 3)));
      if (hit) setD((x) => ({ ...x, postal_code: z, prefecture: hit.prefecture, city: x.city && areas.some((a) => a.city === x.city && a.postal_prefixes.includes(digits.slice(0, 3))) ? x.city : hit.city }));
    }
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PROJECT_PHOTOS - photos.length);
    const shrunk = await Promise.all(list.map(shrinkImage));
    setPhotos((p) => [...p, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const submit = (fd: FormData) => {
    setError(null);
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => fd.set(k, k === "concerns" ? d.concerns.join("、") : (d[k] as string)));
    photos.forEach((p) => fd.append("photos", p.file));
    start(async () => {
      const r = await submitDiagnosisAction(fd);
      if (!r.ok) return setError(r.error);
      sessionStorage.removeItem(STORAGE_KEY);
      router.push(`/matches?project=${r.projectId}`);
      router.refresh();
    });
  };

  return (
    <div ref={topRef} className="mx-auto max-w-xl scroll-mt-20">
      {/* progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-muted">
          <span>
            {step + 1} / {STEPS.length}　{STEPS[step]}
          </span>
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="flex items-center gap-0.5 text-ink-2 hover:text-ink">
              <Icon name="chevron-left" size={14} />
              戻る
            </button>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line-2">
          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div key={step} className="animate-fade-up">
        {step === 0 && (
          <StepFrame title="どんなことでお困りですか？" sub="近いものを1つ選んでください。">
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setD((x) => ({ ...x, category_id: c.id, concerns: x.category_id === c.id ? x.concerns : [] }));
                    go(1);
                  }}
                  className={cx(
                    "rounded-2xl border p-4 text-left transition-colors",
                    d.category_id === c.id ? "border-brand bg-brand-soft/60" : "border-line bg-white hover:border-ink/20",
                  )}
                >
                  <Icon name={c.icon} size={22} className={d.category_id === c.id ? "text-brand" : "text-ink"} />
                  <div className="mt-4 font-bold">{c.name}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-muted">{c.description}</div>
                </button>
              ))}
            </div>
          </StepFrame>
        )}

        {step === 1 && (
          <StepFrame title="工事をする場所はどちらですか？" sub="番地までは不要です。会社には市区町村までしか表示されません。">
            <div className="space-y-4">
              <Field label="郵便番号" hint="入力すると市区町村を自動で選びます（任意）">
                <Input inputMode="numeric" placeholder="251-0047" value={d.postal_code} onChange={(e) => onPostal(e.target.value)} autoComplete="postal-code" />
              </Field>
              <Field label="都道府県" required>
                <Select value={d.prefecture} onChange={(e) => setD((x) => ({ ...x, prefecture: e.target.value, city: "" }))}>
                  {[...prefectures, ...PREFECTURES.filter((p) => !prefectures.includes(p))].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </Field>
              <Field group label="市区町村" required>
                <Chips options={[...cities.map((c) => c.city), "その他の地域"]} value={inArea ? d.city : d.city ? "その他の地域" : ""} onChange={(v) => set("city", v === "その他の地域" ? " " : v)} />
              </Field>
              {d.city && !inArea && (
                <>
                  <Field label="市区町村名">
                    <Input value={d.city.trim()} onChange={(e) => set("city", e.target.value || " ")} placeholder="例: 鎌倉市" />
                  </Field>
                  <Notice tone="warn" icon="pin">
                    このエリアは現在準備中です。相談内容は保存され、対応会社が増え次第お知らせします。
                  </Notice>
                </>
              )}
            </div>
          </StepFrame>
        )}

        {step === 2 && (
          <StepFrame title="お住まいについて教えてください">
            <div className="space-y-5">
              <Field group label="住宅タイプ" required>
                <Chips options={[...HOUSE_TYPES]} value={d.house_type} onChange={(v) => set("house_type", v)} />
              </Field>
              <Field label="築年数" hint="わからなければ空欄でOKです">
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="numeric" min={0} max={150} className="w-28" value={d.building_age} onChange={(e) => set("building_age", e.target.value)} />
                  <span className="text-sm text-muted">年</span>
                </div>
              </Field>
            </div>
          </StepFrame>
        )}

        {step === 3 && (
          <StepFrame title="気になっていることは？" sub="当てはまるものをすべて選んでください。">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {(category?.concerns ?? []).map((c) => {
                  const on = d.concerns.includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => set("concerns", on ? d.concerns.filter((x) => x !== c) : [...d.concerns, c])}
                      className={cx("rounded-full border px-4 py-2 text-sm font-medium transition-colors", on ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-ink/20")}
                    >
                      {on && "✓ "}
                      {c}
                    </button>
                  );
                })}
              </div>
              <Field label="具体的なお悩み・ご要望" hint="例: 南面の色あせが気になる。屋根も一緒に見てほしい。">
                <Textarea value={d.details} onChange={(e) => set("details", e.target.value)} maxLength={2000} />
              </Field>
            </div>
          </StepFrame>
        )}

        {step === 4 && (
          <StepFrame title="ご予算の目安は？" sub="あとから変更できます。決まっていなくても大丈夫です。">
            <OptionList options={BUDGETS.map((b) => ({ value: b.value, label: b.label }))} value={d.budget} onChange={(v) => { set("budget", v); go(5); }} />
          </StepFrame>
        )}

        {step === 5 && (
          <StepFrame title="いつ頃までに工事したいですか？">
            <div className="space-y-6">
              <OptionList options={TIMINGS.map((t) => ({ value: t.value, label: t.label }))} value={d.desired_timing} onChange={(v) => set("desired_timing", v)} />
              <Field group label="連絡を受けやすい時間帯" hint="会社がチャットを送るタイミングの参考になります（電話はかかってきません）">
                <Chips options={[...CONTACT_TIMES]} value={d.contact_time} onChange={(v) => set("contact_time", v)} />
              </Field>
            </div>
          </StepFrame>
        )}

        {step === 6 && (
          <StepFrame title="写真があれば追加してください" sub="気になる箇所の写真があると、会社がより正確に判断できます（任意・最大10枚）。">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="写真を削除"
                    onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PROJECT_PHOTOS && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-line text-muted hover:bg-soft">
                  <span className="flex flex-col items-center gap-1 text-[12px]">
                    <Icon name="camera" size={22} />
                    追加
                  </span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
                </label>
              )}
            </div>
            <p className="mt-3 text-[12px] text-muted">写真は、あなたの相談に対応できる会社だけが見られます。</p>
          </StepFrame>
        )}

        {step === 7 && category && estimate && (
          <div>
            <div className="text-[12px] font-bold tracking-[0.18em] text-brand">RESULT</div>
            <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight">参考相場と、ご相談内容の整理</h1>
            <div className="mt-6 rounded-3xl border border-line bg-white p-5 sm:p-6">
              <div className="text-sm text-muted">入力内容から見ると、{category.name}の一般的な価格帯は</div>
              <div className="mt-2 text-[34px] font-extrabold tracking-tight">約{manRange(estimate.min, estimate.max)}</div>
              <div className="text-sm text-muted">程度です。{category.price_note && `（${category.price_note}）`}</div>
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13px] leading-relaxed text-ink-2">
                {estimate.notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-faint" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 rounded-3xl bg-soft p-5 text-sm">
              <div className="mb-3 font-bold">ご相談内容</div>
              <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 text-[13px]">
                <dt className="text-muted">場所</dt>
                <dd>{d.prefecture}{d.city.trim()}</dd>
                <dt className="text-muted">お住まい</dt>
                <dd>
                  {d.house_type}
                  {d.building_age && `・築${d.building_age}年`}
                </dd>
                <dt className="text-muted">内容</dt>
                <dd>{[category.name, ...d.concerns].join("・")}</dd>
                <dt className="text-muted">予算</dt>
                <dd>{BUDGETS.find((b) => b.value === d.budget)?.label}</dd>
                <dt className="text-muted">希望時期</dt>
                <dd>{TIMINGS.find((t) => t.value === d.desired_timing)?.label}</dd>
                <dt className="text-muted">写真</dt>
                <dd>{photos.length}枚</dd>
              </dl>
              <button type="button" onClick={() => go(0)} className="mt-3 text-[13px] font-semibold text-brand">
                内容を修正する
              </button>
            </div>

            <form action={submit} className="mt-6 space-y-4">
              {wrongRole ? (
                <Notice tone="warn" icon="alert">
                  企業・運営アカウントでログイン中です。相談を作成するには一般ユーザーとして<Link href="/login" className="underline">ログイン</Link>してください。
                </Notice>
              ) : (
                !loggedIn && (
                  <div className="rounded-3xl border border-line bg-white p-5">
                    <div className="font-bold">結果を保存して、会社を探す</div>
                    <p className="mb-4 mt-1 text-[13px] text-muted">
                      メールアドレスだけで登録できます。電話番号は不要です。登録済みの方は<Link href="/login?next=/diagnosis" className="font-semibold text-brand">ログイン</Link>
                    </p>
                    <div className="space-y-3">
                      <Field label="お名前（ニックネーム可）" required>
                        <Input name="name" autoComplete="nickname" maxLength={40} required />
                      </Field>
                      <Field label="メールアドレス" hint="会社には公開されません" required>
                        <Input name="email" type="email" inputMode="email" autoComplete="email" required />
                      </Field>
                      <Field label="パスワード" hint="8文字以上" required>
                        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
                      </Field>
                    </div>
                  </div>
                )
              )}
              {error && <Notice tone="danger" icon="alert">{error}</Notice>}
              <Button size="lg" className="w-full" disabled={pending || wrongRole}>
                {pending ? "条件に合う会社を探しています…" : "条件に合う会社を探す"}
              </Button>
              <p className="text-center text-[12px] text-muted">この時点で会社に連絡先が伝わることはありません。</p>
            </form>
          </div>
        )}
      </div>

      {step > 0 && step < 7 && step !== 4 && (
        <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button size="lg" className="w-full" disabled={!canNext} onClick={() => go(step + 1)} type="button">
            {step === 6 ? (photos.length ? "診断結果を見る" : "写真なしで診断結果を見る") : "次へ"}
          </Button>
        </div>
      )}
    </div>
  );
}

function StepFrame({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
      {sub && <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(o)}
          className={cx("rounded-full border px-4 py-2.5 text-sm font-medium transition-colors", value === o ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/20")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function OptionList({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-[15px] font-medium transition-colors",
            value === o.value ? "border-brand bg-brand-soft/60 text-brand-ink" : "border-line bg-white hover:border-ink/20",
          )}
        >
          {o.label}
          <span className={cx("grid size-5 place-items-center rounded-full border", value === o.value ? "border-brand bg-brand text-white" : "border-line")}>
            {value === o.value && <Icon name="check" size={12} strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}
