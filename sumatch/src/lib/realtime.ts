// In-process pub/sub used by the SSE endpoint (/api/stream).
// Single-node MVP. To scale out, swap this for Supabase Realtime / Redis pub-sub
// behind the same publish/subscribe interface.
import { EventEmitter } from "node:events";

export interface RealtimeEvent {
  type: "message" | "read" | "notification" | "match" | "quote";
  matchId?: string;
  title?: string;
  body?: string;
  link?: string;
}

const g = globalThis as unknown as { __sumatchBus?: EventEmitter };
const bus = g.__sumatchBus ?? (g.__sumatchBus = new EventEmitter());
bus.setMaxListeners(1000);

export function publish(userIds: string[], event: RealtimeEvent) {
  for (const id of new Set(userIds)) bus.emit(`u:${id}`, event);
}

export function subscribe(userId: string, fn: (e: RealtimeEvent) => void) {
  bus.on(`u:${userId}`, fn);
  return () => bus.off(`u:${userId}`, fn);
}
