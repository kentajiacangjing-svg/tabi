"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceContractAction, cancelProjectAction, reviewAction } from "@/app/actions/customer";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, Textarea, cx } from "./ui";

export function AdvanceContractButton({ contractId, to, label, variant = "secondary" }: { contractId: string; to: "in_progress" | "completed"; label: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(`ステータスを「${label.replace("にする", "")}」に更新しますか？`)) return;
          start(async () => {
            const r = await advanceContractAction(contractId, to);
            if (!r.ok) setError(r.error);
            router.refresh();
          });
        }}
      >
        {label}
      </Button>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

export function CancelProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-[13px] text-muted underline-offset-4 hover:underline"
      onClick={() => {
        if (!confirm("この相談を取り下げますか？マッチ中の会社とのチャットは閲覧のみになります。")) return;
        start(async () => {
          await cancelProjectAction(projectId);
          router.refresh();
        });
      }}
    >
      この相談を取り下げる
    </button>
  );
}

export function ReviewForm({ projectId, companyName }: { projectId: string; companyName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          fd.set("rating", String(rating));
          const r = await reviewAction(fd);
          if (!r.ok) return setError(r.error);
          router.refresh();
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <div className="font-bold">{companyName}の口コミを書く</div>
      <div className="flex gap-1" role="radiogroup" aria-label="評価">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} className={cx("p-0.5", i <= rating ? "text-[#E3A008]" : "text-line")} aria-label={`${i}点`}>
            <Icon name="star" size={30} fill="currentColor" strokeWidth={1} />
          </button>
        ))}
      </div>
      <Field label="タイトル">
        <Input name="title" maxLength={60} placeholder="例: 説明が丁寧で安心できました" />
      </Field>
      <Field label="感想" required>
        <Textarea name="body" rows={4} minLength={10} maxLength={1000} required />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button disabled={pending || !rating}>投稿する</Button>
    </form>
  );
}
