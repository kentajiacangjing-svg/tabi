// 読み取り専用：サンプル（デモ）データと実データの件数を表示します。何も変更しません。
// 使い方: STORAGE_DIR=./storage node scripts/db-inspect.mjs
import { inspect } from "./db-lib.mjs";

const r = inspect();
if (!r.exists) {
  console.log("データベースはまだありません。");
} else {
  console.log(JSON.stringify(r, null, 2));
  console.log(r.hasRealData ? "\n⚠ 実データ（デモ以外のアカウント・相談）があります。初期化・復元の前に必ずバックアップしてください。" : "\nデモデータのみです。");
}
