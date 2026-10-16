import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { projectsForCustomer } from "@/lib/queries";
import { PROJECT_STATUS } from "@/lib/constants";
import { dateShort, manRange } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { Icon } from "@/components/icons";
import { StatusStepper } from "@/components/status-stepper";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "相談の管理" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser(["customer"], "/projects");
  const projects = projectsForCustomer(user.id);
  return (
    <div>
      <PageHeader
        title={`${user.name.split(" ")[0]}さんの相談`}
        description="相談ごとに、会社選び・見積もり・契約の進み具合を確認できます。"
        action={<ButtonLink href="/diagnosis" size="sm"><Icon name="plus" size={16} />新しく相談</ButtonLink>}
      />
      {projects.length === 0 ? (
        <EmptyState icon="home" title="まだ相談はありません" action={<ButtonLink href="/diagnosis">無料で相談する</ButtonLink>}>
          カテゴリや予算を選ぶだけで、参考相場と条件に合う会社がわかります。
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => {
            const next =
              p.status === "consulting"
                ? p.matched_count
                  ? { text: "会社とチャットで相談しましょう", href: "/messages" }
                  : p.requested_count
                    ? { text: "会社の返答を待っています", href: `/matches?project=${p.id}` }
                    : { text: "話したい会社を選びましょう", href: `/matches?project=${p.id}` }
                : p.status === "quoting" || p.status === "comparing"
                  ? { text: `見積もりが${p.quote_count}件届いています`, href: `/quotes?project=${p.id}` }
                  : { text: "契約内容と進み具合を確認", href: `/projects/${p.id}` };
            return (
              <div key={p.id} className="rounded-3xl border border-line bg-white p-5 sm:p-6">
                <Link href={`/projects/${p.id}`} className="flex gap-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-soft sm:size-20">
                    {p.cover_file_id ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(p.cover_file_id)!} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-muted"><Icon name={p.category_icon} size={26} /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={p.status === "completed" ? "ok" : p.status === "cancelled" ? "neutral" : "brand"}>{PROJECT_STATUS[p.status].label}</Badge>
                      <span className="text-[12px] text-faint">{dateShort(p.created_at)} 作成</span>
                    </div>
                    <div className="mt-1.5 truncate text-[17px] font-bold">{p.title}</div>
                    <div className="mt-0.5 truncate text-[13px] text-muted">
                      {p.city}・{p.house_type}・予算 {manRange(p.budget_min, p.budget_max)}
                    </div>
                  </div>
                </Link>
                {p.status !== "cancelled" && (
                  <div className="mt-5">
                    <StatusStepper status={p.status} />
                  </div>
                )}
                {p.status !== "cancelled" && (
                  <Link href={next.href} className="mt-5 flex items-center justify-between rounded-2xl bg-soft px-4 py-3 text-sm font-semibold hover:bg-line-2">
                    <span className="flex items-center gap-2">
                      {next.text}
                      {p.unread > 0 && <span className="rounded-full bg-brand px-2 text-[11px] leading-5 text-white">未読 {p.unread}</span>}
                    </span>
                    <Icon name="chevron-right" size={18} className="text-muted" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
