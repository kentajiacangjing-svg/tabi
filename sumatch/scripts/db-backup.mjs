// バックアップ：DB（VACUUM INTO による一貫したコピー）とアップロードファイルを backups/ に保存します。
// 元のデータは変更しません。使い方: STORAGE_DIR=./storage node scripts/db-backup.mjs [ラベル]
import { backup } from "./db-lib.mjs";

const label = (process.argv[2] || "manual").replace(/[^a-zA-Z0-9_-]/g, "");
const { dir, manifest } = backup(label);
console.log(`バックアップしました: ${dir}`);
console.log(`DB sha256: ${manifest.db_sha256} / ファイル ${manifest.upload_files}件`);
