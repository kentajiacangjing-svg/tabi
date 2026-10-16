import { PROJECT_STATUS, STATUS_FLOW } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/types";
import { cx } from "./ui";

/** Where the consultation is, in words. A thin line, no colourful progress bar. */
export function StatusStepper({ status }: { status: ProjectStatus }) {
  const current = PROJECT_STATUS[status].step;
  if (status === "cancelled") return <p className="text-[15px] text-muted">この相談は取り下げました。</p>;
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]" aria-label="進み具合">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx(i === current ? "font-medium text-ink" : i < current ? "text-ink-2" : "text-faint")} aria-current={i === current ? "step" : undefined}>
            {PROJECT_STATUS[s].label}
          </span>
          {i < STATUS_FLOW.length - 1 && <span className={cx("h-px w-4", i < current ? "bg-ink-2" : "bg-line")} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
