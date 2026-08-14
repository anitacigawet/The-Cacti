import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { documents } from "../../drizzle/schema.js";
import { normalizeImpact } from "../_core/impact.js";
import { sql, desc } from "drizzle-orm";

export const analyticsRouter = router({
  metrics: publicProcedure.query(async () => {
    const db = getDb();
    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(documents);
    const [{ analyzed }] = await db
      .select({ analyzed: sql<number>`COUNT(*)` })
      .from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`);
    const cities = await db.selectDistinct({ city: documents.city }).from(documents);
    const sources = await db.selectDistinct({ source: documents.source }).from(documents);

    return {
      totalDocuments: total,
      analyzedDocuments: analyzed,
      analysisCoverage: total > 0 ? Math.round((analyzed / total) * 100) : 0,
      totalSources: sources.length,
      totalCities: cities.length,
    };
  }),

  sentimentDistribution: publicProcedure.query(async () => {
    const db = getDb();
    const docs = await db
      .select({ sentiment: documents.sentiment })
      .from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`);

    const counts: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    for (const doc of docs) {
      const s = (doc.sentiment || "neutral").toLowerCase();
      if (s in counts) counts[s]++;
      else counts.neutral++;
    }
    return counts;
  }),

  impactDistribution: publicProcedure.query(async () => {
    const db = getDb();
    const docs = await db
      .select({ impactLevel: documents.impactLevel })
      .from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`);

    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    for (const doc of docs) {
      const impact = doc.impactLevel === 1 ? "High" : doc.impactLevel === 0 ? "Low" : "Medium";
      if (impact in counts) counts[impact]++;
      else counts.Medium++;
    }
    return counts;
  }),

  sourceBreakdown: publicProcedure.query(async () => {
    const db = getDb();
    return await db
      .select({ source: documents.source, count: sql<number>`COUNT(*)` })
      .from(documents)
      .groupBy(documents.source)
      .orderBy(desc(sql`COUNT(*)`));
  }),

  cityBreakdown: publicProcedure.query(async () => {
    const db = getDb();
    return await db
      .select({ city: documents.city, count: sql<number>`COUNT(*)` })
      .from(documents)
      .groupBy(documents.city)
      .orderBy(desc(sql`COUNT(*)`));
  }),

  categoryBreakdown: publicProcedure.query(async () => {
    const db = getDb();
    return await db
      .select({ category: documents.category, count: sql<number>`COUNT(*)` })
      .from(documents)
      .groupBy(documents.category)
      .orderBy(desc(sql`COUNT(*)`));
  }),

  timeline: publicProcedure.query(async () => {
    const db = getDb();
    const docs = await db
      .select({ publishedAt: documents.publishedAt, city: documents.city })
      .from(documents);

    const byDay: Record<string, Record<string, number>> = {};
    for (const doc of docs) {
      if (!doc.publishedAt) continue;
      const day = new Date(doc.publishedAt).toISOString().split("T")[0];
      const city = doc.city || "Unknown";
      if (!byDay[day]) byDay[day] = {};
      byDay[day][city] = (byDay[day][city] || 0) + 1;
    }

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cities]) => ({
        date,
        total: Object.values(cities).reduce((s, c) => s + c, 0),
        ...cities,
      }));
  }),

  topTopics: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(15) }))
    .query(async ({ input }) => {
      const db = getDb();
      const docs = await db
        .select({ topics: documents.topics })
        .from(documents)
        .where(sql`${documents.topics} IS NOT NULL`);

      const topicCounts: Record<string, number> = {};
      for (const doc of docs) {
        const topics = (doc.topics as string[] | null) || [];
        for (const topic of topics) {
          const t = String(topic).trim();
          if (t) topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
      }

      return Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, input.limit)
        .map(([topic, count]) => ({ topic, count }));
    }),

  recentIntelligence: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const db = getDb();
      const docs = await db
        .select()
        .from(documents)
        .where(sql`${documents.analysis} IS NOT NULL`)
        .orderBy(desc(documents.scrapedAt))
        .limit(input.limit);

      return docs.map((doc) => {
        const analysis = doc.analysis as Record<string, any> | null;
        return {
          id: doc.id,
          title: doc.title,
          city: doc.city,
          source: doc.source,
          publishedDate: doc.publishedAt?.toISOString() ?? null,
          summary: analysis?.Summary ?? "",
          sentiment: doc.sentiment ?? "neutral",
          sentimentScore: (analysis?.Sentiment?.Score as number | null) ?? 0,
          impactLevel: normalizeImpact(analysis?.["Impact Level"]) ?? "Medium",
          topics: (doc.topics as string[] | null)?.slice(0, 3) ?? [],
        };
      });
    }),
});
