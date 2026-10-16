"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Evt {
  type: "message" | "read" | "notification" | "match" | "quote" | "ping";
  matchId?: string;
  title?: string;
  body?: string;
  link?: string;
}

interface Toast {
  id: number;
  title: string;
  body?: string;
  link?: string;
}

/** Subscribes to /api/stream. Re-broadcasts events as `sumatch:event` window events for pages (e.g. chat). */
export function RealtimeClient({ browserNotify }: { browserNotify: boolean }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/stream");
      es.onmessage = (m) => {
        let e: Evt;
        try {
          e = JSON.parse(m.data);
        } catch {
          return;
        }
        if (e.type === "ping") return;
        window.dispatchEvent(new CustomEvent("sumatch:event", { detail: e }));
        if (e.type === "notification" && e.title) {
          const title = e.title;
          // Decide after a beat: the page that triggered the event may be navigating to the same place.
          setTimeout(() => {
            const here = window.location.pathname;
            const onThisChat = (e.link && here === e.link) || /\/match\//.test(here) || (e.link && /\/match\//.test(e.link) && /\/(leads|matches)/.test(here));
            if (!onThisChat) {
              const id = Date.now() + Math.random();
              setToasts((t) => [...t.slice(-2), { id, title, body: e.body, link: e.link }]);
              setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
              if (browserNotify && document.hidden && "Notification" in window && Notification.permission === "granted") {
                const n = new Notification(title, {
                  body: e.body,
                  tag: e.link,
                  icon: "/icon.svg",
                });
                n.onclick = () => {
                  window.focus();
                  if (e.link) router.push(e.link);
                };
              }
            }
          }, 700);
          // Refresh server components (badges, lists) — debounced.
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 400);
        }
      };
      es.onerror = () => {
        es?.close();
        setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, [router, browserNotify]);

  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <Link
          key={t.id}
          href={t.link || "#"}
          onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
          className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-pop)]"
        >
          <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[15px] font-medium">{t.title}</span>
            {t.body && <span className="mt-0.5 block truncate text-[13px] text-muted">{t.body}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}
