import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { documents } from "../../drizzle/schema.js";
import { normalizeImpact } from "../_core/impact.js";
import { gt, desc, sql } from "drizzle-orm";

type SSEClient = {
  id: string;
  send: (event: string, data: unknown) => void;
};

const clients: SSEClient[] = [];
let lastPollTime = new Date();
let pollInterval: NodeJS.Timeout | null = null;

function broadcast(event: string, data: unknown) {
  for (const client of clients) {
    try {
      client.send(event, data);
    } catch {
      // disconnected — cleaned up on req close
    }
  }
}

async function pollForUpdates() {
  try {
    const db = getDb();
    const newDocs = await db
      .select()
      .from(documents)
      .where(gt(documents.scrapedAt, lastPollTime))
      .orderBy(desc(documents.scrapedAt))
      .limit(10);

    if (newDocs.length > 0) {
      lastPollTime = new Date();
      for (const doc of newDocs) {
        const analysis = doc.analysis as Record<string, any> | null;
        broadcast("document", {
          id: doc.id,
          title: doc.title,
          city: doc.city,
          source: doc.source,
          sentiment: doc.sentiment ?? "neutral",
          impactLevel: normalizeImpact(analysis?.["Impact Level"]) ?? "Medium",
          timestamp: doc.scrapedAt?.toISOString() ?? new Date().toISOString(),
        });
      }

      const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(documents);
      const [{ analyzed }] = await db
        .select({ analyzed: sql<number>`COUNT(*)` })
        .from(documents)
        .where(sql`${documents.analysis} IS NOT NULL`);
      broadcast("metrics", { totalDocuments: total, analyzedDocuments: analyzed });
    }
  } catch (err) {
    console.error("[Realtime] Poll error:", err);
  }
}

function ensurePolling() {
  if (!pollInterval && clients.length > 0) {
    pollInterval = setInterval(() => { pollForUpdates().catch((err) => console.error("[Realtime] Poll error:", err)); }, 30000);
  }
}

function checkStopPolling() {
  if (pollInterval && clients.length === 0) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function registerSSERoute(app: import("express").Express) {
  app.get("/api/sse/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const client: SSEClient = {
      id: clientId,
      send: (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      },
    };

    clients.push(client);
    ensurePolling();
    client.send("connected", { clientId, timestamp: new Date().toISOString() });

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      const idx = clients.findIndex((c) => c.id === clientId);
      if (idx !== -1) clients.splice(idx, 1);
      checkStopPolling();
    });
  });
}

// realtimeRouter is intentionally empty — the live data path is the SSE
// Express route registered by registerSSERoute() above, not tRPC. The
// previous status + activityFeed tRPC procedures had no client callers
// (they're replaced by the useSSE hook and analytics.recentIntelligence
// respectively). Kept as an empty router so the appRouter typegraph
// retains the `realtime` namespace if we ever add real tRPC procedures.
export const realtimeRouter = router({});
