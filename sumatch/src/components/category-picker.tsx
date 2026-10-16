"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "./ui";

export interface PickerCategory {
  slug: string;
  name: string;
  description: string;
}

/** Top page: one question, big choices, one button. */
export function CategoryPicker({ featured, more }: { featured: PickerCategory[]; more: PickerCategory[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const options = showMore ? [...featured, ...more] : featured;

  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="工事の種類">
        {options.map((c) => {
          const on = picked === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(c.slug)}
              className={cx(
                "press flex min-h-[72px] flex-col items-start justify-center rounded-xl border px-5 py-3.5 text-left",
                on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/30",
              )}
            >
              <span className="text-[18px] font-medium">{c.name}</span>
              <span className={cx("text-[13px]", on ? "text-white/75" : "text-muted")}>{c.description}</span>
            </button>
          );
        })}
        {!showMore && more.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="press flex min-h-[72px] items-center rounded-xl border border-dashed border-line px-5 text-left text-[18px] font-medium text-ink-2 hover:border-ink/30"
          >
            その他
          </button>
        )}
      </div>
      <Button size="lg" className="mt-8 w-full sm:w-64" disabled={!picked} onClick={() => picked && router.push(`/diagnosis?category=${picked}`)}>
        次へ
      </Button>
    </div>
  );
}
