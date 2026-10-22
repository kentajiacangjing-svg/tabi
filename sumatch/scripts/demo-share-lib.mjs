// Checks for sharing the demo through a Cloudflare Quick Tunnel. Plain Node, no app imports, no network.
//
// The shared demo is the sample data only: demo mode on, mail and AI off, the whole site behind SITE_BASIC_AUTH,
// the app listening on 127.0.0.1 so it is reachable only from this machine and through the tunnel.

export const DEFAULT_PORT = 3100;
export const DEFAULT_STORAGE = "./storage-demo";
export const MIN_GATE_PASSWORD = 12;

/**
 * Returns { errors, warnings, env }: errors stop the launch; env is the environment to start the app with.
 * `inspected` is the result of db-lib inspect() for the storage that will be used.
 */
export function planDemoShare(source, inspected, { allowAccounts = false } = {}) {
  const errors = [];
  const warnings = [];

  const gate = source.SITE_BASIC_AUTH ?? "";
  const sep = gate.indexOf(":");
  if (sep < 1) errors.push("SITE_BASIC_AUTH が未設定です（形式：ユーザー名:パスワード）。サイト全体のパスワードなしでは共有しません。");
  else if (gate.length - sep - 1 < MIN_GATE_PASSWORD) errors.push(`SITE_BASIC_AUTH のパスワードは${MIN_GATE_PASSWORD}文字以上にしてください。`);
  else if (gate.slice(sep + 1).includes("sumatch123")) errors.push("SITE_BASIC_AUTH にデモ用パスワード（公開済み）を使わないでください。");

  if (source.DEMO_MODE === "false") errors.push("DEMO_MODE=false では共有しません（共有できるのはサンプルデータのデモだけです）。");

  const port = Number(source.DEMO_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) errors.push("DEMO_PORT は 1024〜65535 の数字にしてください。");

  if (inspected?.exists && inspected.hasRealData) {
    const msg = `このデータベースにはサンプル以外のアカウントが ${inspected.users.real} 件あります（参加者がテスト中に登録したもの等）。架空の情報だけであることを確認してください。`;
    if (allowAccounts) warnings.push(msg);
    else errors.push(`${msg} 確認済みなら --allow-test-accounts を付けて起動してください。`);
  }

  if (source.APP_URL && !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?$/.test(source.APP_URL) && !source.APP_URL.startsWith("http://localhost")) {
    warnings.push("APP_URL がトンネルのURL（https://〜.trycloudflare.com）ではありません。");
  }

  const env = { ...source };
  // never send anything outside: no mail, no AI draft (its key is dropped from the app's environment)
  for (const k of ["ANTHROPIC_API_KEY", "AI_DRAFT_ENABLED", "MAIL_TRANSPORT", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) delete env[k];
  Object.assign(env, {
    DEMO_MODE: "true",
    MAIL_TRANSPORT: "none",
    ROBOTS_NOINDEX: "true",
    STORAGE_DIR: source.STORAGE_DIR || DEFAULT_STORAGE,
    // the app listens on 127.0.0.1, so only cloudflared reaches it: trust the client address Cloudflare sets
    CLIENT_IP_HEADER: source.CLIENT_IP_HEADER || "cf-connecting-ip",
    // Quick Tunnels do not pass server-sent events; chat falls back to polling every 20 s
    REALTIME_STREAM: "off",
  });
  return { errors, warnings, env, port, host: "127.0.0.1" };
}

/** The command to run in a second terminal. Email addresses come from TUNNEL_ALLOWED_EMAILS (comma separated). */
export function tunnelCommand(port, allowedEmails = "") {
  const emails = allowedEmails
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mail = emails.map((e) => ` --allowed-mail '${e.replaceAll("'", "")}'`).join("");
  return `cloudflared tunnel --url http://127.0.0.1:${port}${mail}`;
}
