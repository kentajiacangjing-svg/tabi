// 復元：バックアップから DB とアップロードを戻します。アプリを停止してから実行してください。
// 復元の前に、現在のデータを自動でバックアップします。
// 使い方: STORAGE_DIR=./storage node scripts/db-restore.mjs backups/<フォルダ> --yes
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, STORAGE_DIR, UPLOAD_DIR, backup, hasFlag, sha256File } from "./db-lib.mjs";

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, "manifest.json"))) {
  console.error("バックアップのフォルダ（manifest.json があるもの）を指定してください。");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
if (sha256File(path.join(src, "sumatch.db")) !== manifest.db_sha256) {
  console.error("バックアップの DB がマニフェストと一致しません（破損または改変）。中止しました。");
  process.exit(1);
}
console.log(`復元元: ${src}（${manifest.created_at}）`);
console.log(`復元先: ${STORAGE_DIR}`);
if (!hasFlag("--yes")) {
  console.log("内容を確認し、実行する場合は --yes を付けてください（現在のデータは先にバックアップされます）。");
  process.exit(0);
}
if (fs.existsSync(DB_PATH)) console.log(`現在のデータを退避しました: ${backup("before-restore").dir}`);
fs.mkdirSync(STORAGE_DIR, { recursive: true });
for (const ext of ["", "-wal", "-shm"]) fs.rmSync(DB_PATH + ext, { force: true });
fs.copyFileSync(path.join(src, "sumatch.db"), DB_PATH);
fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
if (fs.existsSync(path.join(src, "uploads"))) fs.cpSync(path.join(src, "uploads"), UPLOAD_DIR, { recursive: true });
console.log("復元しました。アプリを起動してください。");
