import { and, sql } from "drizzle-orm";
import type { Express, Request } from "express";
import { documents } from "../../drizzle/schema.js";
import { getUserFromRequest } from "../_core/auth.js";
import { router } from "../_core/trpc.js";
import { visibleDocuments } from "../_core/visibility.js";
import { getDb } from "../db.js";

/** Re-read the session/tier on every poll: a stream can outlive a login or role. */
export async function visibleMetrics(req: Request) {
  const user = await getUserFromRequest(req).catch(() => null);
  const db = getDb();
  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(documents).where(visibleDocuments(user));
  const [{ analyzed }] = await db.select({ analyzed: sql<number>`COUNT(*)` }).from(documents)
    .where(and(visibleDocuments(user), sql`${documents.analysis} IS NOT NULL`));
  return { totalDocuments: total, analyzedDocuments: analyzed };
}

export function registerSSERoute(app: Express) {
  app.get("/api/sse/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("connected", { timestamp: new Date().toISOString() });

    // Fixed cadence, independent of fresh inserts. Never broadcast document payloads
    // across tiers. Dashboard listeners refresh through the same filtered API.
    let polling = false;
    const poll = setInterval(async () => {
      if (polling || res.destroyed) return;
      polling = true;
      try {
        const metrics = await visibleMetrics(req);
        if (!res.destroyed) send("metric", metrics);
      } catch (error) {
        console.error("[Realtime] Poll error:", error);
      } finally {
        polling = false;
      }
    }, 30_000);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(poll);
      clearInterval(heartbeat);
    });
  });
}

export const realtimeRouter = router({});
