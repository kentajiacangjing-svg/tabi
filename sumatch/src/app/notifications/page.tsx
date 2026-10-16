import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, now, run } from "@/lib/db";
import { relative } from "@/lib/format";
import { AppShell } from "@/components/app-shell";
import { EmptyState, PageHeader, cx } from "@/components/ui";
import type { Notification } from "@/lib/types";

export const metadata = { title: "お知らせ" };
export const dynamic = "force-dynamic";


export default async function NotificationsPage() {
  const user = await requireUser(undefined, "/notifications");
  const items = all<Notification>("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", user.id);
  // Opening the inbox marks everything as read (items still render with their previous state).
  run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now(), user.id);
  const mode = user.role === "business" ? "business" : user.role === "admin" ? "admin" : "customer";
  return (
    <AppShell mode={mode}>
      <div className="mx-auto max-w-[720px]">
        <PageHeader title="お知らせ"  />
        {items.length === 0 ? (
          <EmptyState icon="bell" title="お知らせはまだありません" />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link || "#"} className="flex gap-3 py-4 hover:bg-soft/60">
                  <span className={cx("mt-2.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : n.kind === "match" ? "bg-match" : "bg-brand")} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cx("truncate text-[16px]", !n.read_at && "font-medium")}>{n.title}</span>
                      <span className="shrink-0 text-[13px] text-faint">{relative(n.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[14px] text-muted">{n.body}</span>
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
