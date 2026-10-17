"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { Button, cx } from "./ui";
import { categoryPhoto } from "@/lib/visuals";

export interface PickerCategory {
  slug: string;
  name: string;
  description: string;
}

/** Top page: one question, big choice cards, one button. */
export function CategoryPicker({ featured, more, withTabBar }: { featured: PickerCategory[]; more: PickerCategory[]; withTabBar?: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [missing, setMissing] = useState(false);
  const options = showMore ? [...featured, ...more] : featured;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4" role="radiogroup" aria-label="工事の種類">
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
                "lift group relative overflow-hidden rounded-[24px] border-2 bg-surface text-left shadow-[var(--shadow-card)]",
                on ? "border-brand" : "border-transparent",
              )}
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={categoryPhoto(c.slug)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                <span
                  className={cx(
                    "absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full border-2 transition-colors duration-200",
                    on ? "border-brand bg-brand text-white" : "border-white/90 bg-black/10 text-transparent",
                  )}
                  aria-hidden="true"
                >
                  <Icon name="check" size={15} strokeWidth={2.6} />
                </span>
              </span>
              <span className={cx("block px-3.5 pb-3.5 pt-3 transition-colors duration-200 sm:px-4 sm:pb-4", on && "bg-brand-soft")}>
                <span className={cx("block text-[17px] font-semibold leading-snug sm:text-[19px]", on && "text-brand")}>{c.name}</span>
                <span className="mt-0.5 block truncate text-[12px] text-muted sm:text-[13px]">{c.description}</span>
              </span>
            </button>
          );
        })}
        {!showMore && more.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="press col-span-2 flex min-h-14 items-center justify-center gap-1.5 rounded-2xl text-[15px] text-ink-2 hover:bg-surface"
          >
            ほかの工事を見る
            <Icon name="chevron-down" size={16} />
          </button>
        )}
      </div>
      {/* stays in reach of the thumb while the cards scroll */}
      <div className={cx("z-10 mt-6 lg:static lg:mt-8", picked && "sticky", withTabBar ? "bottom-[calc(76px+env(safe-area-inset-bottom))]" : "bottom-[calc(12px+env(safe-area-inset-bottom))]")}>
        {missing && !picked && (
          <p role="alert" className="mb-3 flex items-center gap-1.5 text-[14px] text-danger">
            <Icon name="alert" size={15} />
            工事の種類を選んでください
          </p>
        )}
        <Button
          size="lg"
          className={cx("w-full", !picked && "opacity-55")}
         
          onClick={() => {
            if (!picked) return setMissing(true);
            router.push(`/diagnosis?category=${picked}`);
          }}
        >
          次へ
        </Button>
      </div>
    </div>
  );
}
