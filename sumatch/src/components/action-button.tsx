"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cx } from "./ui";

type Result = { ok: true } | { ok: false; error: string };

/** Calls a (pre-bound) server action, shows errors inline, refreshes the page. */
export function ActionButton({
  action,
  children,
  confirmText,
  tone = "neutral",
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  confirmText?: string;
  tone?: "neutral" | "brand" | "danger";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            setError(r.ok ? null : r.error);
            router.refresh();
          });
        }}
        className={cx(
          "min-h-10 rounded-lg border px-3.5 text-[13px] font-medium disabled:opacity-50",
          tone === "brand" && "border-brand bg-brand text-white",
          tone === "danger" && "border-danger/30 text-danger hover:bg-danger-soft",
          tone === "neutral" && "border-line text-ink-2 hover:bg-soft",
        )}
      >
        {children}
      </button>
      {error && <span className="mt-1 text-[11px] text-danger">{error}</span>}
    </span>
  );
}

export function ActionForm({ action, children, className }: { action: (fd: FormData) => Promise<Result>; children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await action(fd);
          setMsg(r.ok ? { ok: true, text: "保存しました" } : { ok: false, text: r.error });
          router.refresh();
        })
      }
      className={className}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {msg && <span className={cx("text-[12px]", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</span>}
    </form>
  );
}
