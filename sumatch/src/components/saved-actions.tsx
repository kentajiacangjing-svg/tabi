"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markCompanyAction, requestMatchAction } from "@/app/actions/customer";
import { Button } from "./ui";

export function SavedActions({ matchId, canConsult }: { matchId: string; canConsult: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending || !canConsult}
        onClick={() =>
          start(async () => {
            const r = await requestMatchAction(matchId);
            if (!r.ok) return setMsg(r.error);
            if (r.status === "matched") return router.push(`/match/${r.matchId}`);
            router.refresh();
          })
        }
      >
        相談する
      </Button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await markCompanyAction(matchId, "unsave"), router.refresh()))}
        className="min-h-10 px-3 text-[14px] text-muted hover:text-ink"
      >
        保存を外す
      </button>
      {msg && <span className="text-[13px] text-danger">{msg}</span>}
    </div>
  );
}

export function ConsultButton({ matchId, disabledReason }: { matchId: string; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="lg"
        className="w-full"
        disabled={pending || !!disabledReason}
        onClick={() =>
          start(async () => {
            const r = await requestMatchAction(matchId);
            if (!r.ok) return setMsg(r.error);
            if (r.status === "matched") return router.push(`/match/${r.matchId}`);
            setMsg("相談を送りました。返事が来たらお知らせします。");
            router.refresh();
          })
        }
      >
        相談する
      </Button>
      {(msg || disabledReason) && <p className="mt-2 text-center text-[14px] text-muted">{msg ?? disabledReason}</p>}
    </div>
  );
}
