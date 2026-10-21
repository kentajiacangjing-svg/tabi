"use client";

import { soft } from "@/lib/soft";
import { useEffect, useState, useTransition } from "react";
import { changePasswordAction, markNotificationsReadAction, requestAccountDeletionAction, updateAccountAction, withdrawAccountDeletionAction } from "@/app/actions/customer";
import { Button, Field, Input, Notice } from "./ui";

export function AccountForm({ name, notifyEmail, notifyBrowser, mailActive }: { name: string; notifyEmail: boolean; notifyBrowser: boolean; mailActive: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    if ("Notification" in window) setPerm(Notification.permission);
  }, []);
  return (
    <form
      action={(fd) =>
        start(async () => {
          if (fd.get("notify_browser") && "Notification" in window && Notification.permission === "default") {
            setPerm(await Notification.requestPermission());
          }
          const r = await soft(updateAccountAction(fd));
          setMsg(r.ok ? { ok: true, text: "保存しました。" } : { ok: false, text: r.error });
        })
      }
      className="space-y-4"
    >
      <Field label="お名前（ニックネーム可）">
        <Input name="name" defaultValue={name} maxLength={40} required />
      </Field>
      <fieldset className="space-y-2.5">
        <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">通知</legend>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="notify_email" defaultChecked={notifyEmail} className="size-4 accent-[var(--color-brand)]" />
          メールで通知を受け取る（新着の見積・マッチ成立など）
        </label>
        {!mailActive && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] leading-relaxed text-warn">
            テスト運用中のため、現在メールは送信されていません。お知らせはアプリ内（ベルのマーク）とブラウザ通知で届きます。
          </p>
        )}
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="notify_browser" defaultChecked={notifyBrowser} className="size-4 accent-[var(--color-brand)]" />
          ブラウザ通知を受け取る
          {perm === "denied" && <span className="text-[12px] text-warn">（ブラウザの設定でブロックされています）</span>}
        </label>
      </fieldset>
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      <Button disabled={pending}>保存する</Button>
    </form>
  );
}

export function PasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await soft(changePasswordAction(fd));
          setMsg(r.ok ? { ok: true, text: "パスワードを変更しました。" } : { ok: false, text: r.error });
        })
      }
      className="space-y-4"
    >
      <Field label="現在のパスワード">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="新しいパスワード" hint="8文字以上">
        <Input name="next" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {msg && <Notice tone={msg.ok ? "ok" : "danger"}>{msg.text}</Notice>}
      <Button variant="secondary" disabled={pending}>変更する</Button>
    </form>
  );
}

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => void (await soft(markNotificationsReadAction())))}>
      すべて既読にする
    </Button>
  );
}

/** 退会の申請。申請を受け付けるだけで、アカウントとデータは運営が確認してから扱う。 */
export function DeletionRequestForm({ pending: requested }: { pending: boolean }) {
  const [state, setState] = useState<"idle" | "sent" | "withdrawn">(requested ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (state === "sent")
    return (
      <div className="space-y-3">
        <Notice tone="neutral">退会の申請を受け付けています。運営が確認し、アプリ内のお知らせでご連絡します。</Notice>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await soft(withdrawAccountDeletionAction());
              if (!r.ok) return setError(r.error);
              setState("withdrawn");
            })
          }
        >
          申請を取り下げる
        </Button>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    );
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          if (!confirm("退会を申請しますか？進行中の相談や契約がある場合は、運営から確認のご連絡をします。")) return;
          const r = await soft(requestAccountDeletionAction(fd));
          if (!r.ok) return setError(r.error);
          setState("sent");
        })
      }
    >
      {state === "withdrawn" && <Notice tone="ok">申請を取り下げました。</Notice>}
      <p className="text-[14px] leading-relaxed text-muted">
        申請後、運営が内容を確認して手続きします。契約・取引の記録など、法令や紛争対応のために一定期間保管が必要な情報は、保管期間の定めに従って扱います（保管期間は現在確認中です）。
      </p>
      <Field label="理由（任意）">
        <Input name="reason" maxLength={500} />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "送信中…" : "退会を申請する"}
      </Button>
    </form>
  );
}
