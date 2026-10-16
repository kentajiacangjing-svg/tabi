import Link from "next/link";
import { get } from "@/lib/db";
import type { MatchContext } from "@/lib/access";
import { messagesFor, type Conversation } from "@/lib/queries";
import { CHAT_TEMPLATES, PROJECT_STATUS, TIMINGS } from "@/lib/constants";
import { manRange, relative } from "@/lib/format";
import type { Category } from "@/lib/types";
import { CompanyAvatar, UserAvatar } from "./brand";
import { Chat } from "./chat";
import { Icon } from "./icons";
import { Badge, cx } from "./ui";

export function ChatPage({ ctx, viewerName, conversations }: { ctx: MatchContext; viewerName: string; conversations: Conversation[] }) {
  const side = ctx.side;
  const cat = get<Category>("SELECT name FROM categories WHERE id = ?", ctx.project.category_id);
  const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", ctx.project.customer_id);
  const messages = messagesFor(ctx.match.id);
  const otherReadAt = side === "customer" ? ctx.match.company_last_read_at : ctx.match.customer_last_read_at;
  const base = side === "company" ? "/business/messages" : "/messages";
  const timing = TIMINGS.find((t) => t.value === ctx.project.desired_timing)?.label;
  const closedForOthers = ctx.match.status !== "matched";
  const templates = (side === "company" ? CHAT_TEMPLATES.company : CHAT_TEMPLATES.customer).map((t) =>
    t.replace("{name}", viewerName.split(" ")[0]).replace("{category}", cat?.name ?? ""),
  );
  const quoteHref = side === "customer" ? `/quotes?project=${ctx.project.id}` : `/business/quotes?match=${ctx.match.id}`;
  const otherName = side === "customer" ? ctx.company.name : `${customer?.name ?? "お客"}様`;

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-20 flex bg-white md:static md:z-auto md:h-[calc(100dvh-8.5rem)] md:overflow-hidden md:rounded-3xl md:border md:border-line">
      {/* conversation list (desktop) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-line md:flex">
        <div className="border-b border-line px-4 py-3.5 text-sm font-bold">メッセージ</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <Link key={c.match_id} href={`${base}/${c.match_id}`} className={cx("flex gap-3 border-b border-line-2 px-4 py-3 hover:bg-soft", c.match_id === ctx.match.id && "bg-soft")}>
              {side === "company" ? <UserAvatar name={c.customer_name} size={36} /> : <CompanyAvatar name={c.company_name} color={c.company_color} logoFileId={c.company_logo} size={36} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{side === "company" ? `${c.customer_name}様` : c.company_name}</span>
                  <span className="shrink-0 text-[10px] text-faint">{relative(c.last_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-muted">{c.last_kind === "quote" ? "見積書" : c.last_kind === "image" ? "写真" : c.last_kind === "file" ? "PDF" : c.last_message}</span>
                  {c.unread > 0 && <span className="grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-[18px] text-white">{c.unread}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="flex items-center gap-2.5 border-b border-line px-2 py-2 sm:px-4">
          <Link href={base} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-soft md:hidden" aria-label="一覧へ戻る">
            <Icon name="chevron-left" size={22} />
          </Link>
          {side === "company" ? <UserAvatar name={customer?.name ?? "?"} size={36} /> : <CompanyAvatar name={ctx.company.name} color={ctx.company.brand_color} logoFileId={ctx.company.logo_file_id} size={36} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{side === "admin" ? `${customer?.name}様 × ${ctx.company.name}` : otherName}</div>
            <div className="truncate text-[11px] text-muted">{side === "customer" ? `返信の目安: ${ctx.company.avg_response_minutes <= 60 ? "1時間以内" : "数時間以内"}` : `${ctx.project.city}・${cat?.name}`}</div>
          </div>
          {side === "customer" && (
            <Link href={`/company/${ctx.company.id}`} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-soft">
              会社情報
            </Link>
          )}
          {side === "company" && (
            <Link href={`/business/quotes/new?match=${ctx.match.id}`} className="rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-white">
              見積もり作成
            </Link>
          )}
        </div>

        {/* pinned project info */}
        <details className="group border-b border-line bg-soft/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12.5px]">
            <Icon name="pin" size={14} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{ctx.project.title}</span>
              <span className="text-muted">　{ctx.project.city}・{ctx.project.house_type}{ctx.project.building_age != null ? `・築${ctx.project.building_age}年` : ""}</span>
            </span>
            <Badge tone="brand" className="shrink-0">{PROJECT_STATUS[ctx.project.status].label}</Badge>
            <Icon name="chevron-down" size={14} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-3 text-[12px] sm:grid-cols-4">
            <Info label="予算" value={manRange(ctx.project.budget_min, ctx.project.budget_max)} />
            <Info label="希望時期" value={timing ?? "—"} />
            <Info label="連絡しやすい時間" value={ctx.project.contact_time || "—"} />
            <Info label="気になること" value={ctx.project.concerns || "—"} />
            {ctx.project.details && <div className="col-span-full text-ink-2">{ctx.project.details}</div>}
            <div className="col-span-full mt-1 flex flex-wrap gap-3">
              {side === "customer" && (
                <Link href={`/quotes?project=${ctx.project.id}`} className="font-semibold text-brand">見積もりを比較する →</Link>
              )}
              {side === "customer" && <Link href={`/projects/${ctx.project.id}`} className="font-semibold text-brand">相談の詳細 →</Link>}
              {side === "company" && <Link href={`/business/leads/${ctx.project.id}`} className="font-semibold text-brand">案件の詳細・写真 →</Link>}
            </div>
          </div>
        </details>

        <Chat
          matchId={ctx.match.id}
          side={side}
          initialMessages={messages}
          initialOtherReadAt={otherReadAt}
          templates={templates}
          quoteHref={quoteHref}
          readOnly={side === "admin" || closedForOthers}
          readOnlyReason={side === "admin" ? "運営は閲覧のみです。" : "このチャットは終了しています。"}
        />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-muted">{label}　</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ConversationList({ conversations, side }: { conversations: Conversation[]; side: "customer" | "company" }) {
  const base = side === "company" ? "/business/messages" : "/messages";
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      {conversations.map((c) => (
        <Link key={c.match_id} href={`${base}/${c.match_id}`} className="flex gap-3 border-b border-line-2 px-4 py-3.5 last:border-0 hover:bg-soft">
          {side === "company" ? <UserAvatar name={c.customer_name} size={44} /> : <CompanyAvatar name={c.company_name} color={c.company_color} logoFileId={c.company_logo} size={44} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{side === "company" ? `${c.customer_name}様` : c.company_name}</span>
              <span className="shrink-0 text-[11px] text-faint">{relative(c.last_at)}</span>
            </div>
            <div className="truncate text-[12px] text-muted">
              {c.project_city}・{c.project_title}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className={cx("truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-ink-2")}>
                {c.last_kind === "quote" ? "見積書が届きました" : c.last_kind === "image" ? "写真を送信しました" : c.last_kind === "file" ? "PDFを送信しました" : c.last_message}
              </span>
              {c.unread > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-white">{c.unread}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
