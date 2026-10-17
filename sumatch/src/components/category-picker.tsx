"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Button, cx } from "./ui";

export interface PickerCategory {
  slug: string;
  name: string;
  description: string;
}

/** Top page: one question, big choice cards, one button. */
export function CategoryPicker({ featured, more }: { featured: PickerCategory[]; more: PickerCategory[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const options = showMore ? [...featured, ...more] : featured;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="工事の種類">
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
                "press relative flex min-h-[104px] flex-col items-start justify-end rounded-2xl border p-4 text-left shadow-[var(--shadow-card)] sm:min-h-[120px] sm:p-5",
                on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/25",
              )}
            >
              {on && (
                <span className="absolute right-4 top-4" aria-hidden="true">
                  <Icon name="check" size={18} strokeWidth={2.4} />
                </span>
              )}
              <span className="text-[18px] font-medium leading-snug sm:text-[20px]">{c.name}</span>
              <span className={cx("mt-0.5 text-[13px] leading-snug", on ? "text-white/75" : "text-muted")}>{c.description}</span>
            </button>
          );
        })}
        {!showMore && more.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="press col-span-2 flex min-h-14 items-center justify-center rounded-2xl text-[15px] text-ink-2 hover:bg-soft"
          >
            ほかの工事を見る
          </button>
        )}
      </div>
      <Button size="lg" className="mt-8 w-full" disabled={!picked} onClick={() => picked && router.push(`/diagnosis?category=${picked}`)}>
        次へ
      </Button>
    </div>
  );
}
