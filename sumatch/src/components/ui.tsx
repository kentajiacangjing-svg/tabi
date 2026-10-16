import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icons";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-ink",
  dark: "bg-ink text-white hover:bg-ink-2",
  secondary: "bg-white text-ink border border-line hover:bg-soft",
  ghost: "text-ink-2 hover:bg-soft",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
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

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]", className)} {...rest} />;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "dark";
const tones: Record<Tone, string> = {
  neutral: "bg-soft text-ink-2",
  brand: "bg-brand-soft text-brand-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  back,
  action,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <Icon name="chevron-left" size={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5 text-[12px] font-semibold tracking-wider text-brand">{eyebrow}</div>}
          <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
          {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-soft text-muted">
        <Icon name={icon} size={22} />
      </div>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "brand" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className={cx("mt-1.5 text-2xl font-bold tracking-tight sm:text-[28px]", tone === "brand" && "text-brand")}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[15px] text-ink placeholder:text-faint focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-soft";

/** `group` renders a div[role=group] instead of <label> — use it when the field contains buttons (chips). */
export function Field({ label, hint, error, children, required, group }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; required?: boolean; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group" } : {})}>
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        {label}
        {required && <span className="text-[11px] font-medium text-brand">必須</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[12px] text-muted">{hint}</span>}
      {error && <span className="mt-1.5 block text-[12px] text-danger">{error}</span>}
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
    <div className={cx("flex gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed", t, className)}>
      {icon && <Icon name={icon} size={18} className="mt-px shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#E3A008]" aria-label={`評価 ${value.toFixed(1)}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} strokeWidth={1.4} fill={value >= i - 0.25 ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export function Container({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-5xl px-4 sm:px-6", className)} {...rest} />;
}
