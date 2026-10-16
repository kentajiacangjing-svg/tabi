import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, now, run } from "@/lib/db";
import { relative } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader, cx } from "@/components/ui";
import type { Notification } from "@/lib/types";

export const metadata = { title: "お知らせ" };
export const dynamic = "force-dynamic";

const ICON: Record<string, string> = { new_lead: "inbox", match: "users", message: "chat", quote: "doc", contract: "check", quote_due: "clock", company_review: "star", system: "bell" };

export default async function NotificationsPage() {
  const user = await requireUser(undefined, "/notifications");
  const items = all<Notification>("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", user.id);
  // Opening the inbox marks everything as read (items still render with their previous state).
  run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now(), user.id);
  const mode = user.role === "business" ? "business" : user.role === "admin" ? "admin" : "customer";
  return (
    <AppShell mode={mode}>
      <div className="max-w-2xl">
        <PageHeader title="お知らせ"  />
        {items.length === 0 ? (
          <EmptyState icon="bell" title="お知らせはまだありません" />
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {items.map((n) => (
              <li key={n.id} className="border-b border-line-2 last:border-0">
                <Link href={n.link || "#"} className={cx("flex gap-3 px-4 py-3.5 hover:bg-soft", !n.read_at && "bg-brand-soft/40")}>
                  <span className={cx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", n.read_at ? "bg-soft text-muted" : "bg-brand-soft text-brand")}>
                    <Icon name={ICON[n.kind] ?? "bell"} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cx("truncate text-sm", !n.read_at && "font-bold")}>{n.title}</span>
                      <span className="shrink-0 text-[11px] text-faint">{relative(n.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">{n.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
