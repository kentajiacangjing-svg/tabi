"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, addWorkAction, changePlanAction, deleteWorkAction, removeMemberAction, webInterestAction } from "@/app/actions/business";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, Select, cx } from "./ui";

type R = { ok: true } | { ok: false; error: string };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function WorksEditor({ works, categories }: { works: { id: string; title: string; city: string; cost_label: string; image: string | null }[]; categories: { id: string; name: string }[] }) {
  const { pending, error, run } = useAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {works.map((w) => (
          <figure key={w.id} className="group relative">
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.image && <img src={w.image} alt="" className="size-full object-cover" />}
            </div>
            <figcaption className="mt-1.5 text-[12px]">
              <div className="truncate font-semibold">{w.title}</div>
              <div className="text-muted">{w.city} {w.cost_label}</div>
            </figcaption>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("この施工事例を削除しますか？") && run(() => deleteWorkAction(w.id))}
              className="absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-ink/70 text-white"
              aria-label="削除"
            >
              <Icon name="x" size={14} />
            </button>
          </figure>
        ))}
      </div>
      <form key={formKey} action={(fd) => run(() => addWorkAction(fd), () => setFormKey((k) => k + 1))} className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
        <Field label="タイトル" required>
          <Input name="title" placeholder="藤沢市 築20年 外壁塗装" required />
        </Field>
        <Field label="カテゴリ">
          <Select name="category_id" defaultValue="">
            <option value="">選択しない</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="地域">
          <Input name="city" placeholder="藤沢市" />
        </Field>
        <Field label="費用の目安">
          <Input name="cost_label" placeholder="約120万円" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="施工写真" required>
            <Input name="image" type="file" accept="image/*" required className="py-2.5 text-sm" />
          </Field>
        </div>
        {error && <Notice tone="danger" className="sm:col-span-2">{error}</Notice>}
        <div className="sm:col-span-2">
          <Button disabled={pending} variant="secondary">施工事例を追加</Button>
        </div>
      </form>
    </div>
  );
}

export function MembersEditor({ members, isOwner, meId }: { members: { id: string; name: string; email: string; role: string }[]; isOwner: boolean; meId: string }) {
  const { pending, error, run } = useAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <div>
      <ul className="divide-y divide-line-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{m.name}{m.id === meId && <span className="ml-1 text-[11px] font-normal text-muted">（あなた）</span>}</div>
              <div className="truncate text-[12px] text-muted">{m.email}</div>
            </div>
            <span className="text-[13px] text-muted">{m.role === "owner" ? "管理者" : "担当者"}</span>
            {isOwner && m.role !== "owner" && (
              <button type="button" disabled={pending} onClick={() => confirm(`${m.name}さんを削除しますか？`) && run(() => removeMemberAction(m.id))} className="text-[12px] text-muted hover:text-danger">
                削除
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form key={formKey} action={(fd) => run(() => addMemberAction(fd), () => setFormKey((k) => k + 1))} className="mt-6 grid gap-3 border-t border-line pt-6 sm:grid-cols-3">
          <Input name="name" placeholder="担当者名" required />
          <Input name="email" type="email" placeholder="メールアドレス" required />
          <Input name="password" type="password" placeholder="初期パスワード（8文字以上）" minLength={8} required />
          {error && <Notice tone="danger" className="sm:col-span-3">{error}</Notice>}
          <div className="sm:col-span-3"><Button variant="secondary" disabled={pending}>担当者を追加</Button></div>
        </form>
      )}
    </div>
  );
}

export function PlanPicker({ plans, currentId, isOwner }: { plans: { id: string; name: string; price: number; limit: number }[]; currentId: string | null; isOwner: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {plans.map((p) => {
          const on = p.id === currentId;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!isOwner || on || pending}
              onClick={() => confirm(`${p.name}プランに変更しますか？`) && run(() => changePlanAction(p.id))}
              className={cx("rounded-xl border p-5 text-left disabled:cursor-default", on ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-ink/30")}
            >
              <div className="text-[12px] font-semibold tracking-wider">{p.name}{on && "（利用中）"}</div>
              <div className="mt-1 text-lg font-semibold">{p.price.toLocaleString()}円<span className="text-[12px] font-normal opacity-60">/月</span></div>
              <div className="text-[12px] opacity-70">月{p.limit}マッチ</div>
            </button>
          );
        })}
      </div>
      {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
    </div>
  );
}

export function WebInterestButton({ done }: { done: boolean }) {
  const { pending, run } = useAction();
  if (done) return <span className="text-sm font-semibold text-ok">相談を受け付けました。運営からご連絡します。</span>;
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => webInterestAction())}>
      SUMATCH Webについて相談する
    </Button>
  );
}
