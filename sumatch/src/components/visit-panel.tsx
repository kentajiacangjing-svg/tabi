// 現地調査ページ (customer and company). Server component.
import Link from "next/link";
import type { MatchContext } from "@/lib/access";
import { VISIT_ADDRESS_DAYS, visitsFor } from "@/lib/visits";
import { ApproveVisitForm, CloseVisitButton, ProposeVisitForm } from "./visit-forms";
import { Icon } from "./icons";
import { Notice, Row } from "./ui";

const fmt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const STATUS = { proposed: "候補日の確認待ち", approved: "日時決定", declined: "見送り", cancelled: "取り消し" } as const;

export function VisitPanel({ ctx, viewerUserId }: { ctx: MatchContext; viewerUserId: string }) {
  const visits = visitsFor(ctx, viewerUserId);
  const active = visits.find((v) => v.status === "proposed" || v.status === "approved");
  const chatHref = ctx.side === "company" ? `/business/messages/${ctx.match.id}` : `/messages/${ctx.match.id}`;
  return (
    <div className="mx-auto max-w-[680px]">
      <Link href={chatHref} className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-ink">
        <Icon name="chevron-left" size={18} />
        メッセージへ戻る
      </Link>
      <h1 className="text-[26px] font-semibold">現地調査</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {ctx.side === "company"
          ? "候補日を送ると、お客様が日時を選び、訪問先の住所を開示します。住所は御社の担当者だけが、訪問日の" + VISIT_ADDRESS_DAYS + "日後まで確認できます（表示は記録されます）。"
          : `日時を選んで承認すると、訪問先の住所を${ctx.company.name}だけに開示します。電話番号やメールアドレスは開示しません。`}
      </p>

      {active?.status === "approved" && (
        <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[17px] font-medium">日時が決まりました</h2>
          <div className="mt-2">
            <Row label="日時">{fmt(active.visit_at!)}</Row>
            {active.address ? (
              <>
                <Row label="訪問先">{active.address}</Row>
                {active.accessNote && <Row label="メモ">{active.accessNote}</Row>}
              </>
            ) : (
              <Row label="訪問先">表示期限を過ぎたため消去しました</Row>
            )}
            <Row label="表示期限">{fmt(active.visible_until!)}</Row>
          </div>
          <div className="mt-4">
            <CloseVisitButton matchId={ctx.match.id} visitId={active.id} label="この予定を取り消す" />
          </div>
        </section>
      )}

      {active?.status === "proposed" && (
        <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-[17px] font-medium">{ctx.side === "customer" ? `${ctx.company.name}からの候補日` : "お客様の返事を待っています"}</h2>
          {active.note && <p className="mt-2 whitespace-pre-wrap text-[15px] text-ink-2">{active.note}</p>}
          {ctx.side === "customer" ? (
            <div className="mt-4">
              <ApproveVisitForm matchId={ctx.match.id} visitId={active.id} slots={active.slots} companyName={ctx.company.name} days={VISIT_ADDRESS_DAYS} />
              <div className="mt-4">
                <CloseVisitButton matchId={ctx.match.id} visitId={active.id} label="候補日を見送る" />
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <ul className="space-y-1 text-[15px]">
                {active.slots.map((s) => (
                  <li key={s}>・{fmt(s)}</li>
                ))}
              </ul>
              <CloseVisitButton matchId={ctx.match.id} visitId={active.id} label="提案を取り消す" />
            </div>
          )}
        </section>
      )}

      {!active && ctx.side === "company" && (
        <section className="mt-8 rounded-[24px] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 text-[17px] font-medium">候補日を提案する</h2>
          <ProposeVisitForm matchId={ctx.match.id} />
        </section>
      )}
      {!active && ctx.side === "customer" && <Notice className="mt-8">現地調査の候補日が届くと、ここで日時を選べます。</Notice>}

      <Notice tone="neutral" className="mt-8">
        緊急時（雨漏りの拡大など）に急いで連絡を取りたい場合の、運営による連絡の取り次ぎは準備中です。現在は、チャットか、チャット画面の「その他 → 運営に通報」からお知らせください。
      </Notice>

      {visits.filter((v) => v !== active).length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] text-muted">これまでの予定</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line text-[14px]">
            {visits
              .filter((v) => v !== active)
              .map((v) => (
                <li key={v.id} className="flex justify-between gap-3 py-2">
                  <span>{v.visit_at ? fmt(v.visit_at) : `候補 ${v.slots.length}件`}</span>
                  <span className="text-muted">{STATUS[v.status]}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
