// Application-level encryption for the most sensitive columns (contact details, site-visit addresses).
// The database file, its backups and the uploads directory never hold these values in plain text.
//
// Key: DATA_ENCRYPTION_KEY = 32 random bytes, base64 (e.g. `openssl rand -base64 32`). Never in source code.
//   • Production without demo mode: required — saving sensitive data fails loudly without it.
//   • Development / demo / tests: if unset, a key file is created once in STORAGE_DIR (.dev-encryption-key,
//     mode 600). Backups do not include it.
// Rotation: put previous keys in DATA_ENCRYPTION_KEYS_OLD (comma-separated); values are tagged with the id of
// the key that wrote them and decrypt with whichever key matches. New writes always use DATA_ENCRYPTION_KEY.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDemo } from "./demo";
import { DomainError } from "./errors";

const PREFIX = "enc:v1:";

interface Key {
  id: string;
  bytes: Buffer;
}

const keyId = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 8);

function parseKey(b64: string): Buffer {
  const bytes = Buffer.from(b64.trim(), "base64");
  if (bytes.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64).");
  return bytes;
}

let cached: { current: Key; all: Key[] } | null = null;

function keys() {
  if (cached) return cached;
  let current: Buffer;
  if (process.env.DATA_ENCRYPTION_KEY) {
    current = parseKey(process.env.DATA_ENCRYPTION_KEY);
  } else if (process.env.NODE_ENV === "production" && !isDemo()) {
    throw new DomainError("暗号化キー（DATA_ENCRYPTION_KEY）が設定されていないため、連絡先・住所を保存・表示できません。運営にお問い合わせください。");
  } else {
    const file = path.join(path.resolve(process.env.STORAGE_DIR || "./storage"), ".dev-encryption-key");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      // "wx": only the first process creates it; another process starting at the same time reads that one.
      fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    current = parseKey(fs.readFileSync(file, "utf8"));
  }
  const old = (process.env.DATA_ENCRYPTION_KEYS_OLD ?? "").split(",").filter((s) => s.trim()).map(parseKey);
  const all = [current, ...old].map((bytes) => ({ id: keyId(bytes), bytes }));
  cached = { current: all[0], all };
  return cached;
}

/** For tests that change the key environment. */
export function resetKeyCache() {
  cached = null;
}

export function encryptField(plain: string): string {
  if (!plain) return "";
  const { current } = keys();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", current.bytes, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${PREFIX}${current.id}:${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64")}`;
}

/** Plain values written before encryption existed are returned as they are. A value no key can open reads as "". */
export function decryptField(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const [id, b64] = stored.slice(PREFIX.length).split(":");
  const key = keys().all.find((k) => k.id === id);
  if (!key) {
    console.warn("[field-crypto] no key for a stored value (key id mismatch)");
    return "";
  }
  try {
    const raw = Buffer.from(b64, "base64");
    const d = createDecipheriv("aes-256-gcm", key.bytes, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    console.warn("[field-crypto] a stored value could not be decrypted");
    return "";
  }
}

export const isEncrypted = (v: string | null | undefined) => !!v && v.startsWith(PREFIX);
