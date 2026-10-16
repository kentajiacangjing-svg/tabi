"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { requestMatchAction, withdrawRequestAction } from "@/app/actions/customer";
import { Icon } from "./icons";
import { Button, buttonClass } from "./ui";

export function MatchActions({
  matchId,
  status,
  customerInterest,
  companyResponse,
  canRequestMore,
  closed,
}: {
  matchId: string;
  status: "candidate" | "matched" | "closed";
  customerInterest: boolean;
  companyResponse: "none" | "yes" | "no";
  canRequestMore: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "matched") {
    return (
      <Link href={`/messages/${matchId}`} className={buttonClass("primary", "md", "w-full")}>
        <Icon name="chat" size={18} />
        チャットを開く
      </Link>
    );
  }
  if (companyResponse === "no") {
    return <div className="rounded-full bg-soft py-2.5 text-center text-sm text-muted">今回は対応が難しいとの返答でした</div>;
  }
  if (closed) return null;
  if (customerInterest) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 rounded-full bg-brand-soft py-2.5 text-sm font-semibold text-brand-ink">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" />
          会社の返答を待っています
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await withdrawRequestAction(matchId);
              if (!r.ok) setError(r.error);
              router.refresh();
            })
          }
          className="w-full text-center text-[12px] text-muted underline-offset-4 hover:underline"
        >
          希望を取り消す
        </button>
        {error && <p className="text-center text-[12px] text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      <Button
        className="w-full"
        variant={canRequestMore ? "primary" : "secondary"}
        disabled={pending || !canRequestMore}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await requestMatchAction(matchId);
            if (!r.ok) return setError(r.error);
            if (r.status === "matched") router.push(`/messages/${r.matchId}`);
            router.refresh();
          })
        }
      >
        {pending ? "送信中…" : canRequestMore ? "この会社と話したい" : "選べるのは最大3社までです"}
      </Button>
      {companyResponse === "yes" && canRequestMore && <p className="mt-2 text-center text-[12px] font-semibold text-ok">この会社は対応を希望しています。押すとすぐにチャットが始まります。</p>}
      {error && <p className="mt-2 text-center text-[12px] text-danger">{error}</p>}
    </div>
  );
}
