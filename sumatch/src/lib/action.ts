import { ZodError } from "zod";
import { ActionError } from "./auth";
import { DomainError } from "./services";
import { UploadError } from "./files";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Wraps a server action body: known errors become user-facing messages, unknown errors are logged. */
export async function handle<T extends object>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    const result = await fn();
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) {
        const k = issue.path.join(".");
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { ok: false, error: Object.values(fieldErrors)[0] ?? "入力内容を確認してください。", fieldErrors };
    }
    if (e instanceof ActionError || e instanceof DomainError || e instanceof UploadError) {
      return { ok: false, error: e.message };
    }
    console.error("[action]", e);
    return { ok: false, error: "エラーが発生しました。時間をおいて再度お試しください。" };
  }
}

/** FormData -> plain object of trimmed strings (files excluded). */
export function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v.trim();
  return o;
}

export function formFiles(fd: FormData, key: string): File[] {
  return fd.getAll(key).filter((v): v is File => typeof v === "object" && v !== null && "arrayBuffer" in v && (v as File).size > 0);
}
