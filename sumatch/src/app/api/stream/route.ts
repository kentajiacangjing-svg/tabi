// Server-Sent Events: pushes chat/notification events to the signed-in user.
import { getCurrentUser } from "@/lib/auth";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RealtimeEvent | { type: "ping" }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          cleanup();
        }
      };
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      const unsub = subscribe(user.id, send);
      const ping = setInterval(() => send({ type: "ping" }), 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
