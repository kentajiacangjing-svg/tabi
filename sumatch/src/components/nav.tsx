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
  return prefixes.some((p) => (p === "/" ? pathname === "/" || pathname === "/diagnosis" : pathname === p || pathname.startsWith(p + "/")));
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
            className={cx("relative flex min-h-11 items-center px-3 text-[15px]", active ? "text-ink" : "text-muted hover:text-ink")}
          >
            {item.label}
            {!!item.badge && <span className="ml-1.5 text-[13px] font-medium text-brand">{item.badge}</span>}
            {active && <span className="absolute inset-x-3 -bottom-[11px] h-0.5 bg-ink" />}
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
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas md:hidden" aria-label="メインメニュー">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx("relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px]", active ? "text-ink" : "text-faint")}
            >
              <span className="relative">
                <Icon name={item.icon} size={22} strokeWidth={active ? 1.9 : 1.5} />
                {!!item.badge && <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-brand" aria-label={`未読${item.badge}件`} />}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
