"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondLeadAction } from "@/app/actions/chat";
import { Button, buttonClass } from "./ui";

export function LeadActions({
  projectId,
  matchId,
  response,
  matched,
  closed,
  disabled,
}: {
  projectId: string;
  matchId: string;
  response: "none" | "yes" | "no";
  matched: boolean;
  closed: boolean;
  disabled?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (matched)
    return (
      <Link href={`/business/messages/${matchId}`} className={buttonClass("primary", "md", "w-full")}>
        チャットを開く
      </Link>
    );
  if (closed) return <div className="rounded-full bg-soft py-2.5 text-center text-[13px] text-muted">受付終了</div>;
  const respond = (yes: boolean) =>
    start(async () => {
      setError(null);
      const r = await respondLeadAction(projectId, yes);
      if (!r.ok) return setError(r.error);
      if (r.status === "matched") router.push(`/business/messages/${r.matchId}`);
      router.refresh();
    });
  if (response === "yes")
    return (
      <div className="rounded-full bg-brand-soft py-2.5 text-center text-[13px] font-semibold text-brand-ink">対応希望を送信済み・お客様の選択待ち</div>
    );
  if (response === "no")
    return (
      <div className="flex items-center justify-between gap-2 rounded-full bg-soft py-1.5 pl-4 pr-1.5 text-[13px] text-muted">
        見送りました
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => respond(true)}>
          やっぱり対応したい
        </Button>
      </div>
    );
  return (
    <div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={pending || !!disabled} onClick={() => respond(false)}>
          見送る
        </Button>
        <Button className="flex-[2]" disabled={pending || !!disabled} onClick={() => respond(true)}>
          対応したい
        </Button>
      </div>
      {disabled && <p className="mt-2 text-center text-[12px] text-muted">{disabled}</p>}
      {error && <p className="mt-2 text-center text-[12px] text-danger">{error}</p>}
    </div>
  );
}
