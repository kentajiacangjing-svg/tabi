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
  return prefixes.some((p) => (p === "/" ? pathname === "/" || pathname === "/diagnosis" : pathname === p || pathname.startsWith(p + "/") || (p === "/matches" && pathname.startsWith("/match/"))));
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="mr-2 hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx("relative flex min-h-11 items-center rounded-xl px-3.5 text-[15px] transition-colors duration-150", active ? "font-semibold text-brand" : "text-muted hover:text-ink")}
          >
            {item.label}
            {!!item.badge && <span className="ml-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{item.badge}</span>}
            {active && <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Focused flows hide the tab bar: a chat thread, the question flow, the match moment.
  if (/\/messages\/[^/]+$/.test(pathname) || pathname === "/diagnosis" || /\/match\//.test(pathname)) return null;
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-6px_20px_-14px_rgb(17_17_17/0.14)] md:hidden" aria-label="メインメニュー">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx("press relative flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] transition-colors duration-150", active ? "font-medium text-brand" : "text-faint")}
            >
              {active && <span className="absolute top-0 h-[2px] w-6 rounded-b-full bg-brand" aria-hidden="true" />}
              <span className="relative">
                <Icon name={item.icon} size={26} strokeWidth={active ? 2.1 : 1.7} />
                {!!item.badge && <span className="absolute -right-1.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-accent" aria-label={`未読${item.badge}件`} />}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
