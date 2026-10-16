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
      <Link href={`/business/messages/${matchId}`} className={buttonClass("primary", "lg", "w-full")}>
        チャットを開く
      </Link>
    );
  if (closed) return <p className="py-3 text-center text-[15px] text-muted">この相談は受付を終えています</p>;
  const respond = (yes: boolean) =>
    start(async () => {
      setError(null);
      const r = await respondLeadAction(projectId, yes);
      if (!r.ok) return setError(r.error);
      if (r.status === "matched") return router.push(`/business/match/${r.matchId}`);
      router.refresh();
    });
  if (response === "yes")
    return (
      <p className="py-3 text-center text-[15px] text-ink-2">「対応したい」を送りました。お客様が選ぶとメッセージが始まります。</p>
    );
  if (response === "no")
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 text-[15px] text-muted">
        見送りました
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => respond(true)}>
          やっぱり対応したい
        </Button>
      </div>
    );
  return (
    <div>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" disabled={pending} onClick={() => respond(false)}>
          見送る
        </Button>
        <Button size="lg" className="flex-[1.6]" disabled={pending || !!disabled} onClick={() => respond(true)}>
          対応したい
        </Button>
      </div>
      {disabled && <p className="mt-2 text-center text-[12px] text-muted">{disabled}</p>}
      {error && <p className="mt-2 text-center text-[12px] text-danger">{error}</p>}
    </div>
  );
}
