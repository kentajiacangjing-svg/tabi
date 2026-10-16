import fs from "node:fs";
import path from "node:path";
import { STORAGE_DIR, insert, newId, now } from "./db";
import { MAX_UPLOAD_BYTES } from "./constants";
import type { FileRow } from "./types";

export const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");

type Kind = "image" | "pdf";

/** Detect the real type from magic bytes; never trust the client-provided MIME type or extension. */
export function sniff(buf: Buffer): { mime: string; ext: string; kind: Kind } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png", kind: "image" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp", kind: "image" };
  if (buf.toString("ascii", 0, 4) === "GIF8") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brand)) return { mime: "image/heic", ext: "heic", kind: "image" };
  }
  if (buf.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "pdf" };
  return null;
}

export class UploadError extends Error {}

export async function saveUpload(
  file: File,
  opts: { ownerUserId: string; scope: FileRow["scope"]; scopeId: string | null; allow: Kind[] },
): Promise<FileRow> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) throw new UploadError("ファイルが空です。");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("ファイルサイズは10MBまでです。");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type || !opts.allow.includes(type.kind)) {
    throw new UploadError(opts.allow.includes("pdf") ? "画像（JPEG/PNG/WebP/HEIC）またはPDFのみアップロードできます。" : "画像（JPEG/PNG/WebP/HEIC）のみアップロードできます。");
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = newId("file");
  const storagePath = `${id}.${type.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storagePath), buf);
  const row: FileRow = {
    id,
    owner_user_id: opts.ownerUserId,
    scope: opts.scope,
    scope_id: opts.scopeId,
    mime: type.mime,
    size: buf.length,
    original_name: (file.name || `upload.${type.ext}`).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120),
    storage_path: storagePath,
    created_at: now(),
  };
  insert("files", { ...row });
  return row;
}

export function readStoredFile(file: FileRow) {
  const p = path.join(UPLOAD_DIR, path.basename(file.storage_path));
  return fs.readFileSync(p);
}

export { fileUrl } from "./urls";
