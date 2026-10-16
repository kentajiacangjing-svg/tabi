import { PROJECT_STATUS, STATUS_FLOW } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/types";
import { cx } from "./ui";

export function StatusStepper({ status }: { status: ProjectStatus }) {
  const current = PROJECT_STATUS[status].step;
  if (status === "cancelled") return <div className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">この相談は取り下げ済みです。</div>;
  return (
    <ol className="grid grid-cols-6 gap-1">
      {STATUS_FLOW.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="min-w-0">
            <div className={cx("h-1.5 rounded-full", done || active ? "bg-brand" : "bg-line-2")} />
            <div className={cx("mt-2 truncate text-center text-[11px] sm:text-[12px]", active ? "font-bold text-ink" : done ? "text-ink-2" : "text-faint")}>{PROJECT_STATUS[s].label}</div>
          </li>
        );
      })}
    </ol>
  );
}
