"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { draftReplyAction, markReadAction, sendMessageAction } from "@/app/actions/chat";
import { reportAction } from "@/app/actions/customer";
import { CONTACT_FLAG_LABEL, CONTACT_WARNING, detectContactInfo, type ContactFlag } from "@/lib/contact-detect";
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
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return "今日";
  if (d.toDateString() === y.toDateString()) return "昨日";
  return `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`;
}

const yenMan = (n: number | null) => (n == null ? "" : `${(n / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`);

export function Chat({ matchId, side, initialMessages, initialOtherReadAt, templates, quoteHref, readOnly, readOnlyReason }: ChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [otherReadAt, setOtherReadAt] = useState(initialOtherReadAt);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [warn, setWarn] = useState<ContactFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftSource, setDraftSource] = useState<"ai" | "template" | null>(null);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const doSend = (skipCheck = false) => {
    setError(null);
    const body = text.trim();
    if (!body && !file) return;
    if (!skipCheck && body) {
      const flags = detectContactInfo(body);
      if (flags.length) return setWarn(flags);
    }
    setWarn(null);
    const fd = new FormData();
    fd.set("match_id", matchId);
    fd.set("body", body);
    if (file) fd.set("file", file);
    start(async () => {
      const r = await sendMessageAction(fd);
      if (!r.ok) return setError(r.error);
      setText("");
      setFile(null);
      setDraftSource(null);
      await refresh();
    });
  };

  const draft = async () => {
    setDrafting(true);
    setError(null);
    const r = await draftReplyAction(matchId);
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
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4 sm:px-5">
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
                  <span className="rounded-full bg-soft px-3 py-1 text-[11px] font-medium text-muted">{day}</span>
                </div>
              )}
              {m.kind === "system" ? (
                <div className="mx-auto my-2 max-w-md rounded-2xl bg-soft px-4 py-2.5 text-center text-[12px] leading-relaxed text-ink-2">{m.body}</div>
              ) : (
                <div className={cx("flex items-end gap-1.5", isMine ? "flex-row-reverse" : "flex-row")}>
                  <div className={cx("max-w-[78%] sm:max-w-[65%]", isMine ? "items-end" : "items-start", "flex flex-col")}>
                    {!isMine && side !== "admin" && m.sender_name && <span className="mb-0.5 px-1 text-[11px] text-muted">{m.sender_name}</span>}
                    {side === "admin" && <span className="mb-0.5 px-1 text-[11px] text-muted">{m.sender_side === "customer" ? "お客様" : "企業"}・{m.sender_name}</span>}
                    <Bubble m={m} isMine={isMine} quoteHref={quoteHref} />
                    {flagged.length > 0 && (
                      <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-warn">
                        <Icon name="alert" size={12} />
                        {flagged.map((f) => CONTACT_FLAG_LABEL[f]).join("・")}の共有が検知されました
                      </span>
                    )}
                  </div>
                  <div className={cx("flex shrink-0 flex-col pb-0.5 text-[10px] leading-tight text-faint", isMine ? "items-end" : "items-start")}>
                    {isMine && i === lastMineIndex && otherReadAt && otherReadAt >= m.created_at && <span className="text-brand">既読</span>}
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
        <div className="border-t border-line bg-white px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 sm:px-4">
          {warn && (
            <div className="mb-2.5 rounded-2xl border border-warn/30 bg-warn-soft p-3.5 text-[13px] text-warn">
              <div className="flex gap-2 font-semibold">
                <Icon name="alert" size={17} className="shrink-0" />
                {warn.map((f) => CONTACT_FLAG_LABEL[f]).join("・")}が含まれているようです
              </div>
              <p className="mt-1 leading-relaxed text-ink-2">{CONTACT_WARNING}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" type="button" onClick={() => setWarn(null)}>
                  修正する
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => doSend(true)}>
                  このまま送信
                </Button>
              </div>
            </div>
          )}
          {showTemplates && (
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
              {templates.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setText(t);
                    setShowTemplates(false);
                    taRef.current?.focus();
                  }}
                  className="max-w-[16rem] shrink-0 truncate rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-ink-2 hover:bg-soft"
                >
                  {t}
                </button>
              ))}
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
          {draftSource && <div className="mb-1.5 px-1 text-[11px] text-muted">{draftSource === "ai" ? "AIが下書きしました。内容を確認してから送信してください。" : "テンプレートから下書きしました。内容を調整してから送信してください。"}</div>}
          {error && <Notice tone="danger" className="mb-2">{error}</Notice>}
          <div className="flex items-end gap-1.5">
            <div className="flex shrink-0 items-center pb-1">
              <label className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-soft" aria-label="写真・PDFを添付">
                <Icon name="clip" size={20} />
                <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              <button type="button" onClick={() => setShowTemplates((v) => !v)} className={cx("grid size-9 place-items-center rounded-full hover:bg-soft", showTemplates ? "text-brand" : "text-ink-2")} aria-label="テンプレート">
                <Icon name="doc" size={19} />
              </button>
              <button type="button" onClick={draft} disabled={drafting} className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-soft disabled:opacity-40" aria-label="AIで返信を下書き" title="AI返信下書き">
                <Icon name="ai" size={20} className={drafting ? "animate-spin" : ""} />
              </button>
            </div>
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
              placeholder="メッセージを入力"
              className="max-h-40 min-h-[42px] flex-1 resize-none rounded-[20px] py-2.5"
              style={{ height: Math.min(160, 42 + Math.max(0, text.split("\n").length - 1) * 22) }}
              aria-label="メッセージ"
            />
            <button
              type="button"
              onClick={() => doSend()}
              disabled={pending || (!text.trim() && !file)}
              className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-brand text-white disabled:bg-line disabled:text-faint"
              aria-label="送信"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-faint">
            <span>連絡先の交換はせず、SUMATCH内でやり取りしましょう</span>
            <button type="button" onClick={() => setReporting(true)} className="hover:text-ink-2">
              通報
            </button>
          </div>
        </div>
      )}
      {reporting && <ReportDialog matchId={matchId} onClose={() => setReporting(false)} />}
    </div>
  );
}

function Bubble({ m, isMine, quoteHref }: { m: ChatMessage; isMine: boolean; quoteHref?: string }) {
  const base = cx("rounded-[20px] text-[14.5px] leading-relaxed", isMine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-soft text-ink");
  if (m.kind === "quote") {
    return (
      <Link href={quoteHref ?? "#"} className="block w-64 overflow-hidden rounded-[20px] border border-line bg-white text-ink shadow-[var(--shadow-card)] hover:border-ink/20">
        <div className="flex items-center gap-2 border-b border-line bg-soft/70 px-4 py-2.5 text-[12px] font-semibold text-ink-2">
          <Icon name="doc" size={15} />
          見積書{m.quote_version && m.quote_version > 1 ? `（第${m.quote_version}版）` : ""}
        </div>
        <div className="px-4 py-3">
          <div className="truncate text-[13px] text-muted">{m.quote_title}</div>
          <div className="mt-0.5 text-[22px] font-bold tracking-tight">{yenMan(m.quote_total)}</div>
          <div className="text-[11px] text-muted">税込</div>
          {m.file_id && <div className="mt-2 flex items-center gap-1 text-[12px] text-brand"><Icon name="pdf" size={14} />PDF添付あり</div>}
        </div>
        <div className="border-t border-line px-4 py-2.5 text-center text-[13px] font-semibold text-brand">内容を見る</div>
      </Link>
    );
  }
  if (m.kind === "image" && m.file_id) {
    return (
      <div className="space-y-1">
        <a href={`/api/files/${m.file_id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-[18px] border border-line bg-soft">
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
        <a href={`/api/files/${m.file_id}`} target="_blank" rel="noopener" className="flex w-60 items-center gap-3 rounded-[18px] border border-line bg-white px-3.5 py-3 text-ink hover:border-ink/20">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
            <Icon name="pdf" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{m.file_name}</span>
            <span className="text-[11px] text-muted">PDF・タップして開く</span>
          </span>
        </a>
        {m.body && <div className={cx(base, "px-4 py-2.5 whitespace-pre-wrap break-words")}>{m.body}</div>}
      </div>
    );
  }
  return <div className={cx(base, "whitespace-pre-wrap break-words px-4 py-2.5")}>{m.body}</div>;
}

function ReportDialog({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center">
            <div className="font-bold">通報を受け付けました</div>
            <p className="mt-1 text-sm text-muted">運営が内容を確認します。</p>
            <Button className="mt-5" variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        ) : (
          <form
            action={(fd) =>
              start(async () => {
                const r = await reportAction(fd);
                if (!r.ok) return setError(r.error);
                setDone(true);
              })
            }
            className="space-y-3"
          >
            <div className="font-bold">運営に通報する</div>
            <input type="hidden" name="target_type" value="match" />
            <input type="hidden" name="target_id" value={matchId} />
            <Select name="reason" defaultValue="">
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
