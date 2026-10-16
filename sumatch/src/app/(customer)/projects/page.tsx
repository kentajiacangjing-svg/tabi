import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { projectsForCustomer } from "@/lib/queries";
import { StatusStepper } from "@/components/status-stepper";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "相談" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser(["customer"], "/projects");
  const projects = projectsForCustomer(user.id);
  const unseen = all<{ id: string; name: string }>(
    `SELECT m.id, c.name FROM matches m JOIN projects p ON p.id = m.project_id JOIN companies c ON c.id = m.company_id
      WHERE p.customer_id = ? AND m.status = 'matched' AND m.customer_match_seen_at IS NULL ORDER BY m.matched_at DESC`,
    user.id,
  );
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="相談" />

      {unseen.map((m) => (
        <Link key={m.id} href={`/match/${m.id}`} className="mb-6 flex min-h-16 items-center justify-between gap-4 rounded-xl border border-match/40 bg-surface px-5 py-4">
          <span>
            <span className="block text-[13px] text-match">マッチしました</span>
            <span className="text-[17px] font-medium">{m.name}と相談を始められます</span>
          </span>
          <span className="text-[15px] text-ink-2">開く</span>
        </Link>
      ))}

      {projects.length === 0 ? (
        <EmptyState title="まだ相談はありません" action={<ButtonLink href="/" size="lg">相談を始める</ButtonLink>}>
          工事の種類を選ぶところから始められます。
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {projects.map((p) => {
            const next =
              p.status === "consulting"
                ? p.matched_count
                  ? { text: "会社とメッセージで相談する", href: "/messages" }
                  : p.requested_count
                    ? { text: "会社の返事を待っています", href: `/projects/${p.id}` }
                    : { text: "会社を見る", href: `/matches?project=${p.id}` }
                : p.status === "quoting" || p.status === "comparing"
                  ? { text: `見積もりを比べる（${p.quote_count}件）`, href: `/quotes?project=${p.id}` }
                  : { text: "契約と工事の状況を見る", href: `/projects/${p.id}` };
            return (
              <li key={p.id} className="py-7">
                <Link href={`/projects/${p.id}`} className="block">
                  <div className="text-[14px] text-muted">
                    {p.city}・{p.house_type}
                  </div>
                  <div className="mt-1 text-[22px] font-medium">{p.title}</div>
                </Link>
                <div className="mt-3">
                  <StatusStepper status={p.status} />
                </div>
                {p.status !== "cancelled" && (
                  <Link href={next.href} className="mt-5 inline-flex min-h-11 items-center text-[16px] font-medium text-brand underline-offset-4 hover:underline">
                    {next.text}
                    {p.unread > 0 && <span className="ml-2 text-[14px] font-normal text-ink-2">未読{p.unread}件</span>}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
