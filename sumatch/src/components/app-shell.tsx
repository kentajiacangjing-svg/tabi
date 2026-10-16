import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser, membershipFor } from "@/lib/auth";
import { unreadMessageCount, unreadNotificationCount } from "@/lib/queries";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./brand";
import { BottomTabs, DesktopNav, type NavItem } from "./nav";
import { Icon } from "./icons";
import { RealtimeClient } from "./realtime-client";
import { buttonClass, cx } from "./ui";

type Mode = "customer" | "business" | "admin";

export async function AppShell({ mode, children, wide }: { mode: Mode; children: ReactNode; wide?: boolean }) {
  const user = await getCurrentUser();
  const companyId = user?.role === "business" ? (membershipFor(user.id)?.company.id ?? null) : null;
  const unreadMsgs = user ? unreadMessageCount(user.id, user.role, companyId) : 0;
  const unreadNotes = user ? unreadNotificationCount(user.id) : 0;

  let items: NavItem[] = [];
  if (mode === "customer") {
    items = user
      ? [
          { href: "/projects", label: "相談", icon: "home", match: ["/projects", "/matches", "/quotes"] },
          { href: "/diagnosis", label: "新しく相談", icon: "plus" },
          { href: "/messages", label: "メッセージ", icon: "chat", badge: unreadMsgs },
          { href: "/notifications", label: "お知らせ", icon: "bell", badge: unreadNotes },
          { href: "/account", label: "アカウント", icon: "user" },
        ]
      : [];
  } else if (mode === "business") {
    items = [
      { href: "/business/dashboard", label: "ホーム", icon: "chart" },
      { href: "/business/leads", label: "案件", icon: "inbox" },
      { href: "/business/messages", label: "チャット", icon: "chat", badge: unreadMsgs },
      { href: "/business/quotes", label: "見積もり", icon: "doc" },
      { href: "/business/profile", label: "会社情報", icon: "building" },
    ];
  }

  const desktopItems = items.filter((i) => i.href !== "/notifications");
  const homeHref = mode === "business" ? "/business/dashboard" : mode === "admin" ? "/admin" : user ? "/projects" : "/";

  return (
    <div className={cx("min-h-dvh", items.length > 0 && "pb-20 md:pb-0")}>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className={cx("mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6", wide ? "max-w-7xl" : "max-w-5xl")}>
          <Logo href={homeHref} sub={mode === "business" ? "for Business" : mode === "admin" ? "Admin" : undefined} />
          <div className="flex items-center gap-1.5">
            <DesktopNav items={desktopItems} />
            {user ? (
              <>
                <Link href="/notifications" className="relative grid size-10 place-items-center rounded-full text-ink-2 hover:bg-soft" aria-label={`お知らせ ${unreadNotes}件`}>
                  <Icon name="bell" size={20} />
                  {unreadNotes > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-white" />}
                </Link>
                <details className="relative hidden md:block">
                  <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-soft">
                    <span className="grid size-8 place-items-center rounded-full bg-soft text-[13px] font-semibold">{user.name.slice(0, 1)}</span>
                    <span className="max-w-[8rem] truncate">{user.name}</span>
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
                    <div className="px-3 py-2 text-[12px] text-muted">{user.email}</div>
                    {mode === "customer" && <MenuLink href="/account" icon="user">アカウント</MenuLink>}
                    {mode === "business" && <MenuLink href="/business/profile" icon="settings">会社情報・設定</MenuLink>}
                    <form action={logoutAction}>
                      <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-ink-2 hover:bg-soft">
                        <Icon name="logout" size={16} />
                        ログアウト
                      </button>
                    </form>
                  </div>
                </details>
                {mode !== "customer" && (
                  <form action={logoutAction} className="md:hidden">
                    <button className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-soft" aria-label="ログアウト">
                      <Icon name="logout" size={19} />
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "sm")}>
                  ログイン
                </Link>
                <Link href="/diagnosis" className={buttonClass("primary", "sm")}>
                  無料で相談する
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={cx("mx-auto w-full px-4 py-6 sm:px-6 sm:py-10", wide ? "max-w-7xl" : "max-w-5xl")}>{children}</main>
      {items.length > 0 && <BottomTabs items={items} />}
      {user && <RealtimeClient browserNotify={!!user.notify_browser} />}
    </div>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-soft">
      <Icon name={icon} size={16} />
      {children}
    </Link>
  );
}
