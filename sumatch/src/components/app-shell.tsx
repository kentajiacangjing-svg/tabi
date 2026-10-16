import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser, membershipFor } from "@/lib/auth";
import { unreadMessageCount, unreadNotificationCount } from "@/lib/queries";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./brand";
import { BottomTabs, DesktopNav, type NavItem } from "./nav";
import { Icon } from "./icons";
import { RealtimeClient } from "./realtime-client";
import { cx } from "./ui";

type Mode = "customer" | "business" | "admin";

export async function AppShell({ mode, children, wide }: { mode: Mode; children: ReactNode; wide?: boolean }) {
  const user = await getCurrentUser();
  const companyId = user?.role === "business" ? (membershipFor(user.id)?.company.id ?? null) : null;
  const unreadMsgs = user ? unreadMessageCount(user.id, user.role, companyId) : 0;
  const unreadNotes = user ? unreadNotificationCount(user.id) : 0;

  let items: NavItem[] = [];
  if (mode === "customer" && user?.role === "customer") {
    items = [
      { href: "/", label: "ホーム", icon: "home" },
      { href: "/projects", label: "相談", icon: "doc", match: ["/projects", "/matches", "/quotes", "/match"] },
      { href: "/messages", label: "メッセージ", icon: "chat", badge: unreadMsgs },
      { href: "/saved", label: "保存", icon: "star" },
      { href: "/account", label: "アカウント", icon: "user" },
    ];
  } else if (mode === "business") {
    items = [
      { href: "/business/dashboard", label: "ホーム", icon: "home" },
      { href: "/business/leads", label: "新しい相談", icon: "inbox" },
      { href: "/business/active", label: "進行中", icon: "doc", match: ["/business/active", "/business/quotes", "/business/match"] },
      { href: "/business/messages", label: "メッセージ", icon: "chat", badge: unreadMsgs },
      { href: "/business/profile", label: "会社", icon: "building" },
    ];
  }

  const homeHref = mode === "business" ? "/business/dashboard" : mode === "admin" ? "/admin" : "/";
  const width = wide ? "max-w-[1280px]" : "max-w-[1080px]";

  return (
    <div className={cx("min-h-dvh", items.length > 0 && "pb-24 md:pb-0")}>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/95">
        <div className={cx("mx-auto flex h-16 items-center justify-between gap-3 px-5 sm:px-8", width)}>
          <Logo href={homeHref} sub={mode === "business" ? "for Business" : mode === "admin" ? "Admin" : undefined} />
          <div className="flex items-center gap-1">
            <DesktopNav items={items} />
            {user ? (
              <>
                <Link href="/notifications" className="relative grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-soft" aria-label={`お知らせ（未読${unreadNotes}件）`}>
                  <Icon name="bell" size={20} />
                  {unreadNotes > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand" />}
                </Link>
                {mode !== "customer" && (
                  <form action={logoutAction}>
                    <button className="grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-soft" aria-label="ログアウト">
                      <Icon name="logout" size={19} />
                    </button>
                  </form>
                )}
              </>
            ) : (
              <Link href="/login" className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-ink-2 hover:bg-soft">
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={cx("mx-auto w-full px-5 py-8 sm:px-8 sm:py-14", width)}>{children}</main>
      {items.length > 0 && <BottomTabs items={items} />}
      {user && <RealtimeClient browserNotify={!!user.notify_browser} />}
    </div>
  );
}
