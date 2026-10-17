"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "./icons";
import { Kicker, buttonClass } from "./ui";

/** Shown instead of a blank page when a screen fails to load. No codes, no stack — just what to do next. */
export function ErrorState({ reset, homeHref = "/" }: { reset?: () => void; homeHref?: string }) {
  useEffect(() => {
    // keep the detail for the console / monitoring, not for the person
    console.error("[SUMATCH] page failed to load");
  }, []);
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-[440px] flex-col items-center justify-center py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
        <Icon name="alert" size={24} />
      </span>
      <Kicker className="mt-6">通信が不安定な可能性があります</Kicker>
      <h1 className="mt-3 text-[28px] font-bold">読み込めませんでした</h1>
      <p className="mt-2 text-[15px] text-muted">少し時間をおいて、もう一度お試しください。</p>
      <div className="mt-8 grid w-full gap-2">
        {reset && (
          <button type="button" onClick={() => reset()} className={buttonClass("primary", "lg", "w-full")}>
            もう一度試す
          </button>
        )}
        <Link href={homeHref} className="flex min-h-12 items-center justify-center text-[15px] text-muted hover:text-ink">
          ホームへ戻る
        </Link>
      </div>
    </div>
  );
}
