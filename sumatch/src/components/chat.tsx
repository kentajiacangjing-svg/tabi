"use client";

import { soft } from "@/lib/soft";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { draftReplyAction, markReadAction, sendMessageAction } from "@/app/actions/chat";
import { reportAction } from "@/app/actions/customer";
import { CONTACT_BLOCK_MESSAGE, CONTACT_FLAG_LABEL, CONTACT_WARNING, blockedFlags, detectContactInfo, type ContactFlag } from "@/lib/contact-detect";
import { REPORT_REASONS } from "@/lib/constants";
import { timeHM } from "@/lib/format";
import type { ChatMessage } from "@/lib/queries";
import { Icon } from "./icons";
import { Button, Notice, Select, Textarea, cx } from "./ui";

export interface ChatProps {
  matchId: string;
  side: "customer" | "company" | "admin";
  initialMessages: ChatMessage[];
  initialOtherReadAt: string | null;
  templates: string[];
  quoteHref?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  /** Before both sides agree the contract terms, contact details can't be sent (the server refuses them too). */
  /** Contact details are always blocked in chat; this is the reason shown (before / after 契約成立). */
  blockMessage?: string;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return "今日";
  if (d.toDateString() === y.toDateString()) return "昨日";
  return `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`;
}

export function Chat({ matchId, side, initialMessages, initialOtherReadAt, templates, quoteHref, readOnly, readOnlyReason, blockMessage = CONTACT_BLOCK_MESSAGE }: ChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [otherReadAt, setOtherReadAt] = useState(initialOtherReadAt);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warn, setWarn] = useState<{ flags: ContactFlag[]; blocked: boolean } | null>(null);
  const [reportReason, setReportReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftSource, setDraftSource] = useState<"ai" | "template" | null>(null);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/matches/${matchId}/messages`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { messages: ChatMessage[]; otherReadAt: string | null };
    setMessages(j.messages);
    setOtherReadAt(j.otherReadAt);
  }, [matchId]);

  useEffect(() => {
    if (side !== "admin") markReadAction(matchId).catch(() => {});
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ type: string; matchId?: string }>).detail;
      if (detail.matchId !== matchId) return;
      refresh().then(() => {
        if (detail.type === "message" && side !== "admin" && document.visibilityState === "visible") markReadAction(matchId).catch(() => {});
      });
    };
    window.addEventListener("sumatch:event", onEvent);
    const poll = setInterval(refresh, 20_000); // fallback if SSE is blocked by a proxy
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        if (side !== "admin") markReadAction(matchId).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("sumatch:event", onEvent);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, refresh, side]);

  // Keep the newest message in view, including after images finish loading.
  const stickToBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useLayoutEffect(() => {
    stickToBottom();
    const t = [setTimeout(stickToBottom, 120), setTimeout(stickToBottom, 500)];
    return () => t.forEach(clearTimeout);
  }, [messages.length, stickToBottom]);

  // A ref, not just `pending`: Cmd+Enter pressed twice fires before React re-renders the disabled button.
  const sending = useRef(false);
  const doSend = (skipCheck = false) => {
    if (sending.current || pending) return;
    setError(null);
    const body = text.trim();
    if (!body && !file) return;
    if (body) {
      const flags = detectContactInfo(body);
      const blocked = blockedFlags(flags);
      // Contact details before agreement: no way to push it through — fix the text (it stays in the box).
      if (blocked.length) return setWarn({ flags: blocked, blocked: true });
      if (!skipCheck && flags.length) return setWarn({ flags, blocked: false });
    }
    setWarn(null);
    const fd = new FormData();
    fd.set("match_id", matchId);
    fd.set("body", body);
    if (file) fd.set("file", file);
    sending.current = true;
    start(async () => {
      try {
        const r = await soft(sendMessageAction(fd));
        if (!r.ok) return setError(r.error);
        setText("");
        setFile(null);
        setDraftSource(null);
        await refresh();
      } catch {
        setError("送信できませんでした。もう一度お試しください。");
      } finally {
        sending.current = false;
      }
    });
  };

  const draft = async () => {
    setDrafting(true);
    setError(null);
    const r = await soft(draftReplyAction(matchId));
    setDrafting(false);
    if (!r.ok) return setError(r.error);
    setText(r.text);
    setDraftSource(r.source);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const mine = (m: ChatMessage) => m.sender_side === side;
  const lastMineIndex = messages.reduce((acc, m, i) => (mine(m) ? i : acc), -1);

  let lastDay = "";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollerRef} onLoadCapture={stickToBottom} role="log" aria-label="会話の履歴" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.map((m, i) => {
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const isMine = mine(m);
          const flagged = m.contact_flags ? (m.contact_flags.split(",") as ContactFlag[]) : [];
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 text-center">
                  <span className="text-[12px] text-faint">{day}</span>
                </div>
              )}
              {m.kind === "system" ? (
                <div className="mx-auto my-3 max-w-md px-4 text-center text-[13px] leading-relaxed text-muted">{m.body}</div>
              ) : (
                <div className={cx("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}>
                  <div className={cx("max-w-[78%] sm:max-w-[65%]", isMine ? "items-end" : "items-start", "flex flex-col")}>
                    {!isMine && side !== "admin" && m.sender_name && <span className="mb-1 px-1 text-[12px] text-muted">{m.sender_name}</span>}
                    {side === "admin" && <span className="mb-0.5 px-1 text-[12px] text-muted">{m.sender_side === "customer" ? "お客様" : "企業"}・{m.sender_name}</span>}
                    <Bubble m={m} isMine={isMine} quoteHref={quoteHref} />
                    {flagged.length > 0 && (
                      <span className="mt-1 flex items-center gap-1 px-1 text-[12px] text-warn">
                        <Icon name="alert" size={12} />
                        {flagged.map((f) => CONTACT_FLAG_LABEL[f]).join("・")}の共有が検知されました
                      </span>
                    )}
                  </div>
                  <div className={cx("flex shrink-0 flex-col pb-0.5 text-[12px] leading-tight text-faint", isMine ? "items-end" : "items-start")}>
                    {isMine && i === lastMineIndex && otherReadAt && otherReadAt >= m.created_at && <span className="text-ink-2">既読</span>}
                    {isMine && i !== lastMineIndex && otherReadAt && otherReadAt >= m.created_at && <span>既読</span>}
                    <span>{timeHM(m.created_at)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <div className="border-t border-line bg-soft/60 px-4 py-4 text-center text-[13px] text-muted">{readOnlyReason ?? "このチャットは閲覧のみです。"}</div>
      ) : (
        <div className="border-t border-line bg-canvas px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-3 sm:px-4">
          {warn && (
            <div className={cx("mb-3 rounded-xl p-4 text-[14px]", warn.blocked ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn")} role="alert">
              <div className="flex gap-2 font-semibold">
                <Icon name="alert" size={17} className="shrink-0" />
                {warn.blocked ? "この内容は送信できません" : `${warn.flags.map((f) => CONTACT_FLAG_LABEL[f]).join("・")}が含まれているようです`}
              </div>
              <p className="mt-1 leading-relaxed text-ink-2">
                {warn.blocked ? `${blockMessage}（${warn.flags.map((f) => CONTACT_FLAG_LABEL[f]).join("・")}）` : CONTACT_WARNING}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => setWarn(null)}>
                  修正する
                </Button>
                {warn.blocked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setReportReason("連絡先の誤判定（送信できない）");
                      setReporting(true);
                    }}
                  >
                    誤判定を運営に知らせる
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" type="button" onClick={() => doSend(true)}>
                    このまま送信
                  </Button>
                )}
              </div>
            </div>
          )}
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-soft px-3 py-2 text-[13px]">
              <Icon name={file.type === "application/pdf" ? "pdf" : "image"} size={16} />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label="添付を取り消す" className="text-muted">
                <Icon name="x" size={16} />
              </button>
            </div>
          )}
          {draftSource && <div className="mb-1.5 px-1 text-[12px] text-muted">{draftSource === "ai" ? "AIが下書きしました。内容を確認してから送信してください。" : "テンプレートから下書きしました。内容を調整してから送信してください。"}</div>}
          {error && <Notice tone="danger" className="mb-2">{error}</Notice>}
          {showTemplates && (
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={draft} disabled={drafting} className="min-h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink-2 hover:border-ink/30 disabled:opacity-40">
                {drafting ? "下書き中…" : "返信の下書きを作る"}
              </button>
              <button type="button" onClick={() => setReporting(true)} className="min-h-10 rounded-lg px-3 text-[14px] text-muted hover:text-ink">
                運営に通報
              </button>
              <div className="w-full divide-y divide-line border-y border-line">
                {templates.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setText(t);
                      setShowTemplates(false);
                      taRef.current?.focus();
                    }}
                    className="block min-h-11 w-full truncate py-2.5 text-left text-[14px] text-ink-2 hover:text-ink"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="mb-0.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-soft focus-within:outline focus-within:outline-2 focus-within:outline-brand" aria-label="写真を添付">
              <Icon name="image" size={22} />
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Textarea
              ref={taRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  doSend();
                }
              }}
              placeholder="メッセージ"
              className="max-h-40 min-h-[46px] flex-1 resize-none py-2.5"
              style={{ height: Math.min(160, 46 + Math.max(0, text.split("\n").length - 1) * 24) }}
              aria-label="メッセージ"
            />
            <button
              type="button"
              onClick={() => doSend()}
              disabled={pending || (!text.trim() && !file)}
              className="press mb-0.5 h-11 shrink-0 rounded-xl bg-brand px-4 text-[15px] font-medium text-white disabled:bg-line disabled:text-faint"
            >
              送信
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] text-faint">連絡先の交換はせず、ここでやり取りしましょう</span>
            <button type="button" onClick={() => setShowTemplates((v) => !v)} className="min-h-9 px-1 text-[13px] text-muted hover:text-ink" aria-expanded={showTemplates}>
              {showTemplates ? "閉じる" : "その他"}
            </button>
          </div>
        </div>
      )}
      {reporting && (
        <ReportDialog
          matchId={matchId}
          defaultReason={reportReason}
          onClose={() => {
            setReporting(false);
            setReportReason(undefined);
          }}
        />
      )}
    </div>
  );
}

function Bubble({ m, isMine, quoteHref }: { m: ChatMessage; isMine: boolean; quoteHref?: string }) {
  const base = cx("rounded-[24px] text-[16px] leading-relaxed", isMine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-surface text-ink shadow-[var(--shadow-card)]");
  if (m.kind === "quote") {
    return (
      <Link href={quoteHref ?? "#"} className="block w-72 rounded-[24px] border border-line bg-surface p-5 text-ink shadow-[var(--shadow-card)] hover:border-ink/25">
        <div className="flex items-baseline justify-between gap-2 text-[14px] text-muted">
          <span>{m.quote_version && m.quote_version > 1 ? "見積が更新されました" : "見積が届きました"}</span>
          {m.quote_version ? <span className="shrink-0 text-[13px]">第{m.quote_version}版</span> : null}
        </div>
        <div className={cx("mt-2 text-[28px] font-medium leading-none tracking-tight", m.quote_status === "superseded" && "text-muted line-through decoration-1")}>¥{m.quote_total?.toLocaleString("ja-JP")}</div>
        {m.quote_status === "superseded" && <div className="mt-2 text-[13px] font-medium text-warn">この版は更新されています。最新の版を確認してください。</div>}
        {m.quote_days ? <div className="mt-2 text-[14px] text-ink-2">工期：約{m.quote_days}日</div> : null}
        <div className="mt-4 flex h-11 items-center justify-center rounded-xl bg-brand text-[15px] font-medium text-white">見積を見る</div>
      </Link>
    );
  }
  if (m.kind === "image" && m.file_id) {
    return (
      <div className="space-y-1">
        <a href={`/api/files/${m.file_id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-line bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${m.file_id}`} alt={m.file_name ?? "画像"} className="max-h-72 w-auto max-w-full object-cover" loading="lazy" />
        </a>
        {m.body && <div className={cx(base, "px-4 py-2.5 whitespace-pre-wrap break-words")}>{m.body}</div>}
      </div>
    );
  }
  if (m.kind === "file" && m.file_id) {
    return (
      <div className="space-y-1">
        <a href={`/api/files/${m.file_id}`} target="_blank" rel="noopener" className="flex w-64 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-ink hover:border-ink/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-soft text-ink-2">
            <Icon name="pdf" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{m.file_name}</span>
            <span className="text-[12px] text-muted">PDF・タップして開く</span>
          </span>
        </a>
        {m.body && <div className={cx(base, "px-4 py-2.5 whitespace-pre-wrap break-words")}>{m.body}</div>}
      </div>
    );
  }
  return <div className={cx(base, "whitespace-pre-wrap break-words px-4 py-2.5")}>{m.body}</div>;
}

function ReportDialog({ matchId, onClose, defaultReason }: { matchId: string; onClose: () => void; defaultReason?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="animate-zoom fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:items-center" onClick={onClose}>
      <div className="max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto rounded-[24px] bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center">
            <div className="font-semibold">通報を受け付けました</div>
            <p className="mt-1 text-sm text-muted">運営が内容を確認します。</p>
            <Button className="mt-5" variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        ) : (
          <form
            action={(fd) =>
              start(async () => {
                const r = await soft(reportAction(fd));
                if (!r.ok) return setError(r.error);
                setDone(true);
              })
            }
            className="space-y-3"
          >
            <div className="font-semibold">運営に通報する</div>
            <input type="hidden" name="target_type" value="match" />
            <input type="hidden" name="target_id" value={matchId} />
            <Select name="reason" defaultValue={defaultReason ?? ""}>
              <option value="" disabled>
                理由を選んでください
              </option>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Textarea name="detail" placeholder="詳しい状況（任意）" rows={3} />
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                キャンセル
              </Button>
              <Button disabled={pending}>送信</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
