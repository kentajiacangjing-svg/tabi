import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { categoryPhoto } from "@/lib/visuals";
import { Icon } from "@/components/icons";
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
    <div className="mx-auto max-w-[960px]">
      <PageHeader title="相談" kicker="いまの進み具合" />

      {unseen.map((m) => (
        <Link key={m.id} href={`/match/${m.id}`} className="lift mb-6 flex min-h-16 items-center justify-between gap-4 rounded-[24px] bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
          <span className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white" aria-hidden="true">
              <Icon name="check" size={18} strokeWidth={2.6} />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-accent">マッチしました</span>
              <span className="text-[16px] font-semibold">{m.name}と相談を始められます</span>
            </span>
          </span>
          <Icon name="chevron-right" size={18} className="shrink-0 text-muted" />
        </Link>
      ))}

      {projects.length === 0 ? (
        <EmptyState title="まだ相談はありません" action={<ButtonLink href="/" size="lg">相談を始める</ButtonLink>}>
          工事の種類を選ぶところから始められます。
        </EmptyState>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {projects.map((p) => {
            const next =
              p.status === "consulting"
                ? p.matched_count
                  ? { text: "会社とメッセージで相談する", href: "/messages" }
                  : p.requested_count
                    ? { text: "会社の返事を待っています", href: `/projects/${p.id}` }
                    : { text: "会社を見る", href: `/matches?project=${p.id}` }
                : p.status === "quoting" || p.status === "comparing"
                  ? { text: `見積を比べる（${p.quote_count}件）`, href: `/quotes?project=${p.id}` }
                  : { text: "契約と工事の状況を見る", href: `/projects/${p.id}` };
            const slug = get<{ slug: string }>("SELECT slug FROM categories WHERE id = ?", p.category_id)?.slug;
            return (
              <li key={p.id} className="overflow-hidden rounded-[24px] bg-surface shadow-[var(--shadow-card)]">
                <Link href={`/projects/${p.id}`} className="relative block h-36 bg-soft sm:h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={categoryPhoto(slug)} alt="" className="size-full object-cover" />
                  <span className="scrim-b absolute inset-0" />
                  <span className="absolute inset-x-5 bottom-4 text-white">
                    <span className="block text-[13px] text-white/85">{[p.city, p.house_type].filter(Boolean).join("・")}</span>
                    <span className="block truncate text-[20px] font-bold">{p.title}</span>
                  </span>
                </Link>
                <div className="p-5">
                  <StatusStepper status={p.status} />
                  {p.status !== "cancelled" && (
                    <Link href={next.href} className="press mt-5 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-soft text-[15px] font-semibold text-brand hover:bg-[#dcebe1]">
                      {next.text}
                      {p.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] text-white">{p.unread}</span>}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
