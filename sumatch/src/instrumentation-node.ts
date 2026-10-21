// Node.js only: erase personal data past its display period every hour, even if nobody opens the page that
// shows it (lib/retention.ts). The first run is shortly after start-up.
import { purgeExpired } from "./lib/retention";

const run = () => {
  try {
    purgeExpired();
  } catch {
    console.error("[retention] purge failed");
  }
};
setTimeout(run, 30_000).unref();
setInterval(run, 60 * 60_000).unref();
