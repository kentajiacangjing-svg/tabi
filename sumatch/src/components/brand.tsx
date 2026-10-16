import Link from "next/link";
import { cx } from "./ui";
import { fileUrl } from "@/lib/urls";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="18" height="18" rx="6" fill="#0e1116" />
      <rect x="12" y="12" width="18" height="18" rx="6" fill="#2557d6" />
      <path d="M12 14a2 2 0 0 1 2-2h6v6a2 2 0 0 1-2 2h-6z" fill="#7d9cf0" />
    </svg>
  );
}

export function Logo({ href = "/", sub }: { href?: string; sub?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="SUMATCH ホーム">
      <LogoMark />
      <span className="text-[17px] font-extrabold tracking-[0.06em]">SUMATCH</span>
      {sub && <span className="rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">{sub}</span>}
    </Link>
  );
}

export function CompanyAvatar({
  name,
  color,
  logoFileId,
  size = 44,
  className,
}: {
  name: string;
  color: string;
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
      className={cx("grid shrink-0 place-items-center rounded-xl font-bold text-white", className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-soft font-semibold text-ink-2" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1)}
    </div>
  );
}
