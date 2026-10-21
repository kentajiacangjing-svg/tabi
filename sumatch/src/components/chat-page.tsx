import Link from "next/link";
import { get } from "@/lib/db";
import type { MatchContext } from "@/lib/access";
import { messagesFor, type Conversation } from "@/lib/queries";
import { CHAT_TEMPLATES } from "@/lib/constants";
import { relative, responseSpeed } from "@/lib/format";
import type { Category } from "@/lib/types";
import { CompanyAvatar, UserAvatar } from "./brand";
import { Chat } from "./chat";
import { Icon } from "./icons";
import { cx } from "./ui";
import { contactsUnlocked, contractForMatch } from "@/lib/contract";

/** Conversation screen: the other party's name on top, the conversation, the composer. Nothing else. */
export function ChatPage({ ctx, viewerName, conversations }: { ctx: MatchContext; viewerName: string; conversations: Conversation[] }) {
  const side = ctx.side;
  const cat = get<Category>("SELECT name FROM categories WHERE id = ?", ctx.project.category_id);
  const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", ctx.project.customer_id);
  const otherReadAt = side === "customer" ? ctx.match.company_last_read_at : ctx.match.customer_last_read_at;
  const base = side === "company" ? "/business/messages" : "/messages";
  const templates = (side === "company" ? CHAT_TEMPLATES.company : CHAT_TEMPLATES.customer).map((t) =>
    t.replace("{name}", viewerName.split(" ")[0]).replace("{category}", cat?.name ?? ""),
  );
  const quoteHref = side === "customer" ? `/quotes?project=${ctx.project.id}` : `/business/quotes?match=${ctx.match.id}`;
  const title = side === "customer" ? ctx.company.name : side === "company" ? `${customer?.name ?? "お客"}様` : `${customer?.name}様 × ${ctx.company.name}`;
  const titleHref = side === "customer" ? `/company/${ctx.company.id}?project=${ctx.project.id}` : side === "company" ? `/business/leads/${ctx.project.id}` : undefined;
  const cover = get<{ src: string }>("SELECT COALESCE(image_url, '/api/files/' || file_id) AS src FROM company_works WHERE company_id = ? ORDER BY created_at, rowid LIMIT 1", ctx.company.id)?.src;
  const contract = contractForMatch(ctx.match.id);
  const sub = side === "company" ? `${ctx.project.city}・${cat?.name ?? ""}` : `返信の目安 ${responseSpeed(ctx.company.avg_response_minutes)}`;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(60px+env(safe-area-inset-top))] z-20 flex bg-canvas md:static md:z-auto md:h-[calc(100dvh-10rem)] md:overflow-hidden md:rounded-[24px] md:border md:border-line">
      {conversations.length > 0 && (
        <aside className="hidden w-80 shrink-0 flex-col border-r border-line md:flex">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <Link key={c.match_id} href={`${base}/${c.match_id}`} className={cx("flex gap-3 border-b border-line px-5 py-4 hover:bg-soft", c.match_id === ctx.match.id && "bg-soft")}>
                {side === "company" ? <UserAvatar name={c.customer_name} size={40} /> : <CompanyAvatar name={c.company_name} logoFileId={c.company_logo} photo={c.company_cover} size={44} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-medium">{side === "company" ? `${c.customer_name}様` : c.company_name}</span>
                    <span className="shrink-0 text-[12px] text-faint">{relative(c.last_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] text-muted">{c.last_kind === "quote" ? "見積が届きました" : c.last_kind === "image" ? "写真" : c.last_kind === "file" ? "ファイル" : c.last_message}</span>
                    {c.unread > 0 && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="未読あり" />}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-16 items-center gap-2 border-b border-line px-2 sm:px-4">
          <Link href={side === "admin" ? "/admin?tab=chats" : base} className="grid size-11 place-items-center rounded-lg text-ink-2 hover:bg-soft md:hidden" aria-label="一覧へ戻る">
            <Icon name="chevron-left" size={22} />
          </Link>
          {side === "customer" && <CompanyAvatar name={ctx.company.name} logoFileId={ctx.company.logo_file_id} photo={cover} size={40} className="ml-1" />}
          <div className="min-w-0 flex-1 px-2">
            <div className="truncate text-[17px] font-semibold">{title}</div>
            {side !== "admin" && <div className="truncate text-[13px] text-muted">{sub}</div>}
          </div>
          {titleHref && side === "customer" && (
            <Link href={titleHref} className="flex min-h-11 items-center rounded-xl px-3 text-[14px] text-brand hover:bg-soft">
              会社詳細
            </Link>
          )}
          {titleHref && side === "company" && (
            <Link href={titleHref} className="flex min-h-11 items-center rounded-xl px-3 text-[14px] text-ink-2 hover:bg-soft">
              相談内容
            </Link>
          )}
          {contract && side !== "admin" && (
            <Link href={side === "company" ? `/business/contract/${contract.id}` : `/projects/${ctx.project.id}#contract`} className="flex min-h-11 items-center rounded-xl px-3 text-[14px] text-brand hover:bg-soft">
              契約条件
            </Link>
          )}
          {side === "company" && !contract && ["consulting", "quoting", "comparing"].includes(ctx.project.status) && (
            <Link href={`/business/quotes/new?match=${ctx.match.id}`} className="flex min-h-11 items-center rounded-xl px-3 text-[14px] text-brand hover:bg-soft">
              見積を作る
            </Link>
          )}
        </div>

        <Chat
          matchId={ctx.match.id}
          side={side}
          initialMessages={messagesFor(ctx.match.id)}
          initialOtherReadAt={otherReadAt}
          templates={templates}
          quoteHref={quoteHref}
          contactLocked={!contactsUnlocked(ctx.match.id)}
          readOnly={side === "admin" || ctx.match.status !== "matched"}
          readOnlyReason={side === "admin" ? "運営は閲覧のみです。" : "このチャットは終了しています。"}
        />
      </section>
    </div>
  );
}

export function ConversationList({ conversations, side }: { conversations: Conversation[]; side: "customer" | "company" }) {
  const base = side === "company" ? "/business/messages" : "/messages";
  return (
    <ul className="overflow-hidden rounded-[24px] bg-surface shadow-[var(--shadow-card)]">
      {conversations.map((c) => (
        <li key={c.match_id} className="border-b border-line last:border-0">
          <Link href={`${base}/${c.match_id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-canvas sm:px-5">
            {side === "company" ? <UserAvatar name={c.customer_name} size={56} /> : <CompanyAvatar name={c.company_name} logoFileId={c.company_logo} photo={c.company_cover} size={56} />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cx("truncate text-[17px]", c.unread ? "font-semibold" : "font-medium")}>{side === "company" ? `${c.customer_name}様` : c.company_name}</span>
                <span className="shrink-0 text-[13px] text-faint">{relative(c.last_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={cx("truncate text-[15px]", c.unread ? "text-ink" : "text-muted")}>
                  {c.last_kind === "quote" ? "見積が届きました" : c.last_kind === "image" ? "写真を送りました" : c.last_kind === "file" ? "ファイルを送りました" : c.last_message}
                </span>
                {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
