"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { cx } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  match?: string[];
}

function isActive(pathname: string, item: NavItem) {
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "relative rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-soft text-ink" : "text-muted hover:text-ink",
            )}
          >
            {item.label}
            {!!item.badge && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Hide inside a chat thread to give the composer room.
  if (/\/messages\/[^/]+$/.test(pathname)) return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="メインメニュー">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link key={item.href} href={item.href} className={cx("relative flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10.5px] font-medium", active ? "text-ink" : "text-faint")}>
              <span className="relative">
                <Icon name={item.icon} size={22} strokeWidth={active ? 2 : 1.6} />
                {!!item.badge && (
                  <span className="absolute -right-2.5 -top-1 grid min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9.5px] font-bold leading-4 text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
