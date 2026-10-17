import { PROJECT_STATUS, STATUS_FLOW } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/types";
import { cx } from "./ui";

/** Where the consultation is: the current step in words, and a short segmented bar. */
export function StatusStepper({ status }: { status: ProjectStatus }) {
  const current = PROJECT_STATUS[status].step;
  if (status === "cancelled") return <p className="text-[15px] text-muted">この相談は取り下げました。</p>;
  const next = STATUS_FLOW[current + 1];
  return (
    <div aria-label="進み具合">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] font-semibold text-brand" aria-current="step">
          {PROJECT_STATUS[status].label}
        </span>
        {next && <span className="text-[13px] text-muted">次は {PROJECT_STATUS[next].label}</span>}
      </div>
      <ol className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${STATUS_FLOW.length}, minmax(0, 1fr))` }}>
        {STATUS_FLOW.map((s, i) => (
          <li key={s} className={cx("h-1.5 rounded-full", i <= current ? "bg-brand" : "bg-line")} title={PROJECT_STATUS[s].label}>
            <span className="sr-only">
              {PROJECT_STATUS[s].label}
              {i === current ? "（いまここ）" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
