// Runs once when a server process starts (Next.js instrumentation). The Node.js part schedules the hourly
// clean-up of personal data past its display period (see instrumentation-node.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
