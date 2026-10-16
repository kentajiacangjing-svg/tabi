"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { businessSignupAction, updateCompanyProfileAction } from "@/app/actions/business";
import { Button, Field, Input, Notice, Select, Textarea, cx } from "./ui";

export interface CompanyFormValues {
  name: string;
  address: string;
  phone: string;
  email: string;
  contact_person: string;
  tagline: string;
  description: string;
  specialties: string;
  warranty: string;
  website_url: string;
  sns_url: string;
  business_hours: string;
  license_number: string;
  corporate_number: string;
  qualifications: string;
  price_band_min: number;
  price_band_max: number;
  lead_time_weeks: number;
  self_construction: number;
  category_works: Record<string, number>; // selected category ids -> works count
  area_ids: string[];
}

export const EMPTY_COMPANY: CompanyFormValues = {
  name: "",
  address: "",
  phone: "",
  email: "",
  contact_person: "",
  tagline: "",
  description: "",
  specialties: "",
  warranty: "",
  website_url: "",
  sns_url: "",
  business_hours: "",
  license_number: "",
  corporate_number: "",
  qualifications: "",
  price_band_min: 0,
  price_band_max: 0,
  lead_time_weeks: 4,
  self_construction: 1,
  category_works: {},
  area_ids: [],
};

interface Opt {
  id: string;
  name: string;
  sub?: string;
}

export function CompanyForm({
  mode,
  initial,
  categories,
  areas,
  plans,
  defaultPlan,
}: {
  mode: "signup" | "edit";
  initial: CompanyFormValues;
  categories: Opt[];
  areas: Opt[];
  plans?: { code: string; label: string }[];
  defaultPlan?: string;
}) {
  const router = useRouter();
  const [cats, setCats] = useState<Record<string, number>>(initial.category_works);
  const [areaIds, setAreaIds] = useState<string[]>(initial.area_ids);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  // Signup is one section per screen; editing shows everything on one page.
  const stepped = mode === "signup";
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const STEPS = 4;
  const goNext = () => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const fields = section ? Array.from(section.querySelectorAll<HTMLInputElement>("input, select, textarea")) : [];
    for (const f of fields) if (!f.checkValidity()) return f.reportValidity();
    if (step === 1 && (!Object.keys(cats).length || !areaIds.length)) return setError("対応する工事とエリアを1つ以上選んでください。");
    setError(null);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          setSaved(false);
          Object.entries(cats).forEach(([id, n]) => {
            fd.append("category_ids", id);
            fd.set(`works_${id}`, String(n));
          });
          areaIds.forEach((id) => fd.append("area_ids", id));
          const r = mode === "signup" ? await businessSignupAction(fd) : await updateCompanyProfileAction(fd);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          if (mode === "signup" && "redirect" in r) {
            router.push(r.redirect as string);
            router.refresh();
          } else {
            setSaved(true);
            router.refresh();
          }
        })
      }
      className="space-y-8"
      ref={formRef}
    >
      <Section title="会社のこと" step={0} current={stepped ? step : null}>
        <Field label="会社名" required>
          <Input name="name" defaultValue={initial.name} required maxLength={80} />
        </Field>
        <Field label="キャッチコピー" hint="候補カードに表示されます（80文字まで）">
          <Input name="tagline" defaultValue={initial.tagline} maxLength={80} placeholder="例: 塗装職人が直接伺う、湘南の外壁塗装専門店" />
        </Field>
        <Field label="会社説明">
          <Textarea name="description" defaultValue={initial.description} rows={5} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="所在地" required>
            <Input name="address" defaultValue={initial.address} required />
          </Field>
          <Field label="営業時間">
            <Input name="business_hours" defaultValue={initial.business_hours} placeholder="9:00〜18:00（日曜定休）" />
          </Field>
          <Field label="電話番号" hint="運営からの連絡用。お客様には公開されません。" required>
            <Input name="phone" type="tel" defaultValue={initial.phone} required />
          </Field>
          <Field label="会社メールアドレス" hint="運営からの連絡用。お客様には公開されません。" required>
            <Input name="email" type="email" defaultValue={initial.email} required />
          </Field>
          <Field label="担当者名" required>
            <Input name="contact_person" defaultValue={initial.contact_person} required />
          </Field>
        </div>
      </Section>

      <Section title="対応する工事とエリア" sub="選んだ工事とエリアの相談だけが届きます。" step={1} current={stepped ? step : null}>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-2">対応カテゴリと施工実績数</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => {
              const on = c.id in cats;
              return (
                <div key={c.id} className={cx("flex items-center gap-3 rounded-[10px] border px-4 py-3", on ? "border-brand bg-brand-soft/40" : "border-line")}>
                  <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setCats((x) => {
                          const n = { ...x };
                          if (on) delete n[c.id];
                          else n[c.id] = 0;
                          return n;
                        })
                      }
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    {c.name}
                  </label>
                  {on && (
                    <span className="flex items-center gap-1 text-[12px] text-muted">
                      実績
                      <input
                        type="number"
                        min={0}
                        value={cats[c.id]}
                        onChange={(e) => setCats((x) => ({ ...x, [c.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-16 rounded-lg border border-line px-2 py-1 text-right text-sm text-ink"
                        aria-label={`${c.name}の施工実績数`}
                      />
                      件
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-2">対応エリア</div>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => {
              const on = areaIds.includes(a.id);
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAreaIds((x) => (on ? x.filter((y) => y !== a.id) : [...x, a.id]))}
                  className={cx("min-h-11 rounded-[10px] border px-4 text-[15px]", on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/20")}
                >
                  {a.name}
                  {a.sub && <span className={cx("ml-1 text-[11px]", on ? "text-white/60" : "text-faint")}>{a.sub}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="強みと条件" step={2} current={stepped ? step : null}>
        <Field label="得意工事" hint="カンマ区切り">
          <Input name="specialties" defaultValue={initial.specialties} placeholder="外壁塗装, 屋根塗装, 防水" />
        </Field>
        <Field label="保証内容">
          <Input name="warranty" defaultValue={initial.warranty} placeholder="外壁10年保証 / 定期点検あり" />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="価格帯（下限・円）">
            <Input name="price_band_min" type="number" min={0} step={10000} defaultValue={initial.price_band_min || ""} />
          </Field>
          <Field label="価格帯（上限・円）">
            <Input name="price_band_max" type="number" min={0} step={10000} defaultValue={initial.price_band_max || ""} />
          </Field>
          <Field label="着工までの目安（週）">
            <Input name="lead_time_weeks" type="number" min={0} max={52} defaultValue={initial.lead_time_weeks} />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="self_construction" defaultChecked={!!initial.self_construction} className="size-4 accent-[var(--color-brand)]" />
          自社施工（自社の職人が施工する）
        </label>
      </Section>

      <Section title="許可・資格・Web（任意）" sub="登録すると、お客様に安心してもらえます。" step={2} current={stepped ? step : null}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="建設業許可番号">
            <Input name="license_number" defaultValue={initial.license_number} />
          </Field>
          <Field label="法人番号（13桁）">
            <Input name="corporate_number" inputMode="numeric" defaultValue={initial.corporate_number} />
          </Field>
          <Field label="資格">
            <Input name="qualifications" defaultValue={initial.qualifications} placeholder="一級塗装技能士, 外装劣化診断士" />
          </Field>
          <Field label="自社サイトURL">
            <Input name="website_url" type="url" defaultValue={initial.website_url} placeholder="https://" />
          </Field>
          <Field label="SNS URL">
            <Input name="sns_url" type="url" defaultValue={initial.sns_url} placeholder="https://" />
          </Field>
        </div>
        {mode === "edit" && (
          <Field label="ロゴ画像" hint="正方形推奨・10MBまで">
            <Input name="logo" type="file" accept="image/*" className="py-2.5 text-sm" />
          </Field>
        )}
      </Section>

      {mode === "signup" && (
        <Section title="ログイン情報" sub="あとから担当者を追加できます。" step={3} current={stepped ? step : null}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="管理者のお名前" required>
              <Input name="owner_name" required />
            </Field>
            <Field label="ログイン用メールアドレス" required>
              <Input name="login_email" type="email" autoComplete="email" required />
            </Field>
            <Field label="パスワード" hint="8文字以上" required>
              <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
            {plans && (
              <Field label="ご希望のプラン">
                <Select name="plan_code" defaultValue={defaultPlan}>
                  {plans.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-[var(--color-brand)]" required />
            <span>
              利用規約に同意します。お客様とのやり取り・見積もり・契約はSUMATCH内で行い、成約時は成功報酬の対象となることを理解しました。
            </span>
          </label>
        </Section>
      )}

      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      {saved && <Notice tone="ok" icon="check">保存しました。</Notice>}
      {stepped && step < STEPS - 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] tabular-nums text-muted">{step + 1} / {STEPS}</span>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
                戻る
              </Button>
            )}
            <Button type="button" size="lg" onClick={goNext}>
              次へ
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {stepped && <span className="text-[14px] tabular-nums text-muted">{STEPS} / {STEPS}</span>}
          <div className="flex gap-2">
            {stepped && (
              <Button type="button" variant="ghost" size="lg" onClick={() => setStep((s) => s - 1)}>
                戻る
              </Button>
            )}
            <Button size="lg" disabled={pending}>
              {pending ? "送信中…" : stepped ? "登録して審査を申し込む" : "保存する"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, sub, children, step, current }: { title: string; sub?: string; children: React.ReactNode; step: number; current: number | null }) {
  // In stepped mode, hidden sections stay mounted so their fields are still submitted.
  return (
    <section data-step={step} className={cx("border-t border-line pt-8 first:border-0 first:pt-0", current !== null && current !== step && "hidden")}>
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}
