import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "press inline-flex items-center justify-center gap-2 font-medium disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_6px_16px_-8px_rgb(24_77_58/0.6)] hover:bg-brand-2",
  dark: "bg-ink text-white hover:bg-ink-2",
  secondary: "bg-surface text-ink border border-line shadow-[var(--shadow-card)] hover:border-ink/20",
  ghost: "text-ink-2 hover:bg-soft",
  danger: "bg-surface text-danger border border-danger/30 hover:bg-danger-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-[14px] rounded-xl",
  md: "h-12 px-5 text-[15px] rounded-xl",
  lg: "h-14 px-7 text-[16px] rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/** A plain white surface. Use sparingly — whitespace and dividers come first. */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("rounded-[24px] border border-line/60 bg-surface shadow-[var(--shadow-card)]", className)} {...rest} />;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "dark" | "match";
const tones: Record<Tone, string> = {
  neutral: "text-muted",
  brand: "text-brand",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  dark: "text-ink",
  match: "text-match",
};

/** Status text with a small dot. Deliberately not a pill. */
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-medium leading-5", tones[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

/** SUMATCH's signature: a short brand line above a page title, led by a thin green rule. */
export function Kicker({ children, className, tone = "brand" }: { children: ReactNode; className?: string; tone?: "brand" | "light" }) {
  return (
    <p className={cx("flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.06em]", tone === "light" ? "text-white/85" : "text-brand-2", className)}>
      <span className={cx("h-[2px] w-5 shrink-0 rounded-full", tone === "light" ? "bg-white/80" : "bg-brand")} aria-hidden="true" />
      {children}
    </p>
  );
}

export function PageHeader({
  title,
  description,
  back,
  action,
  eyebrow,
  kicker,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 sm:mb-12">
      {back && (
        <Link href={back.href} className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-ink">
          <Icon name="chevron-left" size={18} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && <Kicker className="mb-3">{kicker}</Kicker>}
          {eyebrow && <div className="mb-2 text-[14px] text-muted">{eyebrow}</div>}
          <h1 className="jp text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">{title}</h1>
          {description && <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[20px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start rounded-[24px] bg-surface p-7 shadow-[var(--shadow-card)] sm:p-9">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
        <Icon name={icon ?? "sparkle"} size={22} />
      </span>
      <div className="mt-5 text-[20px] font-bold">{title}</div>
      {children && <div className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Big number + label. No box — numbers are the hierarchy. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "brand" }) {
  return (
    <div className="py-2">
      <div className={cx("tnum text-[40px] font-semibold leading-none sm:text-[48px]", tone === "brand" && "text-brand")}>{value}</div>
      <div className="mt-2 text-[15px] text-ink-2">{label}</div>
      {sub && <div className="mt-0.5 text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-line bg-surface px-4 py-3 text-[16px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-soft";

/** `group` renders a div[role=group] instead of <label> — use it when the field contains buttons (chips). */
export function Field({ label, hint, error, children, required, group }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group" } : {})}>
      <span className="mb-2 flex items-center gap-2 text-[14px] font-medium text-ink-2">
        {label}
        {required && <span className="text-[12px] font-normal text-muted">必須</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[13px] text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-[13px] text-danger">{error}</span>}
    </Tag>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={cx(inputClass, !props.className?.includes("resize-none") && "resize-y", "leading-relaxed", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={cx(inputClass, "appearance-none pr-10", props.className)} />
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Notice({ tone = "brand", icon, children, className }: { tone?: "brand" | "warn" | "ok" | "danger" | "neutral"; icon?: string; children: ReactNode; className?: string }) {
  const t = {
    brand: "bg-brand-soft text-brand-ink",
    warn: "bg-warn-soft text-warn",
    ok: "bg-ok-soft text-ok",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-soft text-ink-2",
  }[tone];
  return (
    <div className={cx("flex gap-2.5 rounded-xl px-4 py-3 text-[14px] leading-relaxed", t, className)} role={tone === "danger" ? "alert" : undefined}>
      {icon && <Icon name={icon} size={18} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-ink" aria-label={`評価 ${value.toFixed(1)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} strokeWidth={1.3} fill={value >= i - 0.25 ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-5xl px-5 sm:px-8", className)} {...rest} />;
}

/** Quiet row used instead of nested cards: label on the left, value on the right. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-3.5 text-[15px] last:border-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
