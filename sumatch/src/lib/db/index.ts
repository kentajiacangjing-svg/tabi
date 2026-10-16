import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

// node:sqlite is loaded through getBuiltinModule so the bundler never tries to resolve it.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");
const DB_PATH = path.join(STORAGE_DIR, "sumatch.db");

type Param = SQLInputValue | boolean | undefined;

const g = globalThis as unknown as { __sumatchDb?: DatabaseSyncType; __sumatchSeeding?: boolean };

function open(): DatabaseSyncType {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

export function db(): DatabaseSyncType {
  if (!g.__sumatchDb) {
    g.__sumatchDb = open();
    const row = g.__sumatchDb.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    if (row.n === 0 && !g.__sumatchSeeding) {
      g.__sumatchSeeding = true;
      try {
        seed();
      } finally {
        g.__sumatchSeeding = false;
      }
    }
  }
  return g.__sumatchDb;
}

function norm(params: Param[]): SQLInputValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  // node:sqlite returns null-prototype rows; spread into plain objects so they can cross to Client Components.
  return db().prepare(sql).all(...norm(params)).map((r) => ({ ...r })) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = db().prepare(sql).get(...norm(params));
  return (row ? { ...row } : undefined) as T | undefined;
}

export function run(sql: string, ...params: Param[]) {
  return db().prepare(sql).run(...norm(params));
}

/** Insert a row from an object. Keys are trusted column names from our own code. */
export function insert(table: string, row: Record<string, Param>) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
  return run(sql, ...keys.map((k) => row[k]));
}

/** Update columns of a row by id. Keys are trusted column names from our own code. */
export function update(table: string, id: string, row: Record<string, Param>, idColumn = "id") {
  const keys = Object.keys(row);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE ${idColumn} = ?`;
  return run(sql, ...keys.map((k) => row[k]), id);
}

let txDepth = 0;
export function tx<T>(fn: () => T): T {
  if (txDepth > 0) return fn();
  const d = db();
  d.exec("BEGIN");
  txDepth++;
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  } finally {
    txDepth--;
  }
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function now() {
  return new Date().toISOString();
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
