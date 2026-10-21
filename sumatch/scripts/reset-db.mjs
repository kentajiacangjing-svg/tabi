// デモデータの初期化：DB とアップロードを消し、次の起動で作り直します（DEMO_MODE に応じた初期データ）。
// 安全のため：
//   • --yes がないと何もしません（内容の表示だけ）。
//   • 実データ（デモ以外のアカウント・相談）がある時は中止します。
//   • 消す前に必ずバックアップします（backups/）。
// 使い方: STORAGE_DIR=./storage node scripts/reset-db.mjs --yes
import fs from "node:fs";
import { DB_PATH, STORAGE_DIR, backup, hasFlag, inspect } from "./db-lib.mjs";

const r = inspect();
if (!r.exists) {
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
  console.log("データベースはありません。次の起動で作成されます。");
  process.exit(0);
}
console.log(`対象: ${STORAGE_DIR}`);
console.log(`ユーザー: デモ ${r.users.demo} / 実データ ${r.users.real}、相談 ${r.projects.total}、契約 ${r.contracts.total}`);
if (r.hasRealData) {
  console.error("実データがあるため中止しました。初期化はデモ専用の環境だけで行ってください（scripts/db-inspect.mjs で確認できます）。");
  process.exit(1);
}
if (!hasFlag("--yes")) {
  console.log("デモデータのみです。初期化する場合は --yes を付けて実行してください。");
  process.exit(0);
}
console.log(`バックアップしました: ${backup("before-reset").dir}`);
fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
console.log(`削除しました: ${DB_PATH} ほか。次の起動で作り直されます。`);
