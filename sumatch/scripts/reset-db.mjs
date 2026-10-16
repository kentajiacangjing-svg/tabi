// Deletes the local SQLite DB and uploads. The app re-creates and re-seeds on next start.
import { rmSync } from "node:fs";
import path from "node:path";
const dir = path.resolve(process.env.STORAGE_DIR || "./storage");
rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}. Start the app to re-create demo data.`);
