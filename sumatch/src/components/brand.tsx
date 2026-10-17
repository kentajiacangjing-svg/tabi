import Link from "next/link";
import { cx } from "./ui";
import { fileUrl } from "@/lib/urls";

/** Two overlapping tiles: "you" and "the company" meeting. Ink + forest green only. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#111111" />
      <rect x="9" y="9" width="14" height="14" rx="3" fill="#1f5a46" />
    </svg>
  );
}

export function Logo({ href = "/", sub }: { href?: string; sub?: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5" aria-label="SUMATCH ホーム">
      <LogoMark />
      <span className="text-[16px] font-semibold tracking-[0.14em]">SUMATCH</span>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </Link>
  );
}

/** Company logo, or a quiet monogram. Never colourful — photos carry the colour. */
export function CompanyAvatar({
  name,
  logoFileId,
  size = 44,
  className,
}: {
  name: string;
  color?: string;
  logoFileId?: string | null;
  size?: number;
  className?: string;
}) {
  const url = fileUrl(logoFileId);
  const initials = name.replace(/株式会社|有限会社|\s/g, "").slice(0, name.match(/^[A-Za-z]/) ? 2 : 1);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={cx("shrink-0 rounded-xl object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-xl border border-line bg-surface font-medium text-ink", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-soft font-medium text-ink-2" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1)}
    </div>
  );
}
