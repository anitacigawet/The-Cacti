import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { documents, documentEntities } from "../../drizzle/schema.js";
import { eq, sql, desc, and } from "drizzle-orm";
import { visibleDocuments } from "../_core/visibility.js";

type EntityNode = {
  id: string;
  name: string;
  type: string;
  mentions: number;
  sentiment: number;
  cities: string[];
  documents: number[];
};

type EntityEdge = {
  source: string;
  target: string;
  weight: number;
};

export const entitiesRouter = router({
  graph: publicProcedure.query(async ({ ctx }) => {
    const db = getDb();

    const rows = await db
      .select({
        entityId: documentEntities.id,
        name: documentEntities.name,
        type: documentEntities.type,
        city: documentEntities.city,
        docId: documentEntities.documentId,
        sentiment: documents.sentiment,
        analysis: documents.analysis,
      })
      .from(documentEntities)
      .innerJoin(documents, eq(documentEntities.documentId, documents.id))
      .where(visibleDocuments(ctx.user));

    const entityMap = new Map<string, EntityNode>();
    const docEntities = new Map<number, string[]>();

    for (const row of rows) {
      const key = `${row.type}::${row.name}`;
      const analysis = row.analysis as Record<string, any> | null;
      const sentimentScore = (analysis?.Sentiment?.Score as number | null) ?? 0.5;

      if (!docEntities.has(row.docId)) docEntities.set(row.docId, []);
      docEntities.get(row.docId)!.push(key);

      if (entityMap.has(key)) {
        const existing = entityMap.get(key)!;
        existing.mentions++;
        existing.sentiment =
          (existing.sentiment * (existing.mentions - 1) + sentimentScore) / existing.mentions;
        if (!existing.cities.includes(row.city ?? "Unknown"))
          existing.cities.push(row.city ?? "Unknown");
        if (!existing.documents.includes(row.docId)) existing.documents.push(row.docId);
      } else {
        entityMap.set(key, {
          id: key,
          name: row.name,
          type: row.type,
          mentions: 1,
          sentiment: sentimentScore,
          cities: [row.city ?? "Unknown"],
          documents: [row.docId],
        });
      }
    }

    const edgeMap = new Map<string, EntityEdge>();
    docEntities.forEach((names) => {
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const [a, b] = [names[i], names[j]].sort();
          const edgeKey = `${a}|||${b}`;
          if (edgeMap.has(edgeKey)) {
            edgeMap.get(edgeKey)!.weight++;
          } else {
            edgeMap.set(edgeKey, { source: a, target: b, weight: 1 });
          }
        }
      }
    });

    const nodes = Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 80);

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = Array.from(edgeMap.values()).filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return { nodes, edges };
  }),

  spotlight: publicProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [entityType, name] = input.entityId.split("::");
      if (!name) return null;

      const rows = await db
        .select({
          docId: documents.id,
          title: documents.title,
          city: documents.city,
          source: documents.source,
          publishedAt: documents.publishedAt,
          analysis: documents.analysis,
        })
        .from(documentEntities)
        .innerJoin(documents, eq(documentEntities.documentId, documents.id))
        .where(and(eq(documentEntities.name, name), visibleDocuments(ctx.user)))
        .orderBy(desc(documents.publishedAt))
        .limit(20);

      const timeline: { date: string; sentiment: number; title: string; docId: number }[] = [];
      let totalSentiment = 0;
      const topics = new Set<string>();

      for (const row of rows) {
        const analysis = row.analysis as Record<string, any> | null;
        const score = (analysis?.Sentiment?.Score as number | null) ?? 0.5;
        totalSentiment += score;
        ((analysis?.["Key Topics"] as string[]) || []).forEach((t: string) => topics.add(t));
        timeline.push({
          date: row.publishedAt?.toISOString() ?? "",
          sentiment: score,
          title: row.title,
          docId: row.docId,
        });
      }

      return {
        name,
        type: entityType || "Unknown",
        totalMentions: rows.length,
        averageSentiment: rows.length > 0 ? totalSentiment / rows.length : 0.5,
        relatedTopics: Array.from(topics).slice(0, 10),
        timeline,
        cities: Array.from(new Set(rows.map((r) => r.city).filter(Boolean))),
      };
    }),

  topByType: publicProcedure
    .input(
      z.object({
        type: z.enum(["People", "Organizations", "Locations"]).default("People"),
        limit: z.number().min(1).max(30).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const typeMap: Record<string, string> = {
        People: "person",
        Organizations: "organization",
        Locations: "location",
      };
      const sqliteType = typeMap[input.type];

      const rows = await db
        .select({ name: documentEntities.name, count: sql<number>`COUNT(*)` })
        .from(documentEntities)
        .innerJoin(documents, eq(documentEntities.documentId, documents.id))
        .where(and(eq(documentEntities.type, sqliteType), visibleDocuments(ctx.user)))
        .groupBy(documentEntities.name)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(input.limit);

      return rows.map((r) => ({ name: r.name, count: r.count }));
    }),
});
