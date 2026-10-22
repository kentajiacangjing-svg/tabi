// 限定デモの共有用にアプリを起動します（サンプルデータのみ・費用0円の構成）。トンネルは起動しません。
//
// 使い方（先に npm run build）:
//   SITE_BASIC_AUTH='ユーザー名:12文字以上のパスワード' npm run demo:share
//   → 表示される cloudflared のコマンドを、内容を確認してから別のターミナルで実行する（ここで外部に公開されます）
//
// 起動する内容：DEMO_MODE=true、メール送信なし、AI下書きなし、noindex、127.0.0.1 だけで待ち受け、
// データは STORAGE_DIR（既定 ./storage-demo。本番用の ./storage とは別）。
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { DEFAULT_STORAGE, planDemoShare, tunnelCommand } from "./demo-share-lib.mjs";

process.env.STORAGE_DIR ||= DEFAULT_STORAGE;
const { inspect } = await import("./db-lib.mjs");

const args = process.argv.slice(2);
const plan = planDemoShare(process.env, inspect(), { allowAccounts: args.includes("--allow-test-accounts") });
if (!fs.existsSync(path.resolve(".next/BUILD_ID"))) plan.errors.push("ビルドがありません。先に npm run build を実行してください。");

for (const w of plan.warnings) console.warn(`⚠ ${w}`);
if (plan.errors.length) {
  for (const e of plan.errors) console.error(`✖ ${e}`);
  process.exit(1);
}

const local = `http://127.0.0.1:${plan.port}`;
console.log(`
SUMATCH 限定デモ（サンプルデータのみ）
  ローカル:      ${local}  （サイト全体のパスワードが必要）
  データ:        ${path.resolve(plan.env.STORAGE_DIR)}
  メール・AI:    送信しません

共有するには、別のターミナルで次を実行します（実行した時点で、URLを知っている人がアクセスできる状態になります）:
  ${tunnelCommand(plan.port, process.env.TUNNEL_ALLOWED_EMAILS)}
${process.env.TUNNEL_ALLOWED_EMAILS ? "" : "  ※ TUNNEL_ALLOWED_EMAILS を設定すると、Cloudflare のメール認証（ワンタイムPIN）付きのコマンドを表示します。\n"}  表示される https://〜.trycloudflare.com が接続URLです。止める時は両方のターミナルで Ctrl+C。
`);

const child = spawn(path.resolve("node_modules/.bin/next"), ["start", "-H", plan.host, "-p", String(plan.port)], {
  env: plan.env,
  stdio: "inherit",
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
