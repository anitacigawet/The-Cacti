import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { documents, documentEntities } from "../../drizzle/schema.js";
import { eq, desc, asc, like, and, sql, lte } from "drizzle-orm";
import { effectiveTier, freshnessThreshold } from "../_core/auth.js";
import { normalizeImpact } from "../_core/impact.js";

export const documentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        city: z.string().optional(),
        source: z.string().optional(),
        category: z.string().optional(),
        sentiment: z.string().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["date", "title", "city"]).default("date"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [];

      const cutoff = freshnessThreshold(effectiveTier(ctx.user));
      conditions.push(lte(documents.createdAt, cutoff));

      if (input.city) conditions.push(eq(documents.city, input.city));
      if (input.source) conditions.push(eq(documents.source, input.source));
      if (input.category) conditions.push(eq(documents.category, input.category));
      if (input.sentiment) conditions.push(eq(documents.sentiment, input.sentiment));
      if (input.search) {
        conditions.push(
          sql`(${documents.title} LIKE ${"%" + input.search + "%"} OR ${documents.content} LIKE ${"%" + input.search + "%"})`
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol =
        input.sortBy === "date"
          ? documents.publishedAt
          : input.sortBy === "title"
          ? documents.title
          : documents.city;
      const order = input.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

      const items = await (where
        ? db.select().from(documents).where(where).orderBy(order)
        : db.select().from(documents).orderBy(order)
      )
        .offset((input.page - 1) * input.limit)
        .limit(input.limit);

      const [{ total }] = await (where
        ? db.select({ total: sql<number>`COUNT(*)` }).from(documents).where(where)
        : db.select({ total: sql<number>`COUNT(*)` }).from(documents)
      );

      return {
        items: items.map((doc) => {
          const analysis = doc.analysis as Record<string, any> | null;
          // Prefer the human-readable label from the AI analysis JSON, but
          // validate — the LLM sometimes leaks topic strings into this
          // field. Fall back to mapping the legacy integer column for
          // older docs.
          const impactText =
            normalizeImpact(analysis?.["Impact Level"]) ??
            (doc.impactLevel === 1
              ? "High"
              : doc.impactLevel === 0
                ? "Low"
                : doc.impactLevel != null
                  ? "Medium"
                  : null);
          return {
            id: doc.id,
            title: doc.title,
            source: doc.source,
            sourceUrl: doc.url,
            category: doc.category,
            city: doc.city,
            content: doc.content,
            publishedDate: doc.publishedAt?.toISOString() ?? null,
            hasAnalysis: !!analysis,
            sentiment: doc.sentiment,
            sentimentScore: (analysis?.Sentiment?.Score as number | null) ?? null,
            impactLevel: impactText,
            summary: (analysis?.Summary as string | null) ?? null,
            topics: doc.topics ?? [],
            categories: (analysis?.Categories as string[] | null) ?? [],
          };
        }),
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const cutoff = freshnessThreshold(effectiveTier(ctx.user));
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), lte(documents.createdAt, cutoff)))
        .limit(1);
      if (!doc) return null;

      const analysis = doc.analysis as Record<string, any> | null;
      const entities = await db
        .select()
        .from(documentEntities)
        .where(eq(documentEntities.documentId, doc.id));

      const entityMap: Record<string, string[]> = {};
      for (const e of entities) {
        if (!entityMap[e.type]) entityMap[e.type] = [];
        entityMap[e.type].push(e.name);
      }

      return {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        sourceUrl: doc.url,
        category: doc.category,
        city: doc.city,
        content: doc.content,
        cleanedContent: doc.content,
        publishedDate: doc.publishedAt?.toISOString() ?? null,
        hasAnalysis: !!analysis,
        analysis: analysis
          ? {
              summary: analysis.Summary || "",
              topics: analysis["Key Topics"] || [],
              sentiment: analysis.Sentiment || { Overall: "unknown", Score: 0 },
              impactLevel: normalizeImpact(analysis["Impact Level"]) ?? "Unknown",
              categories: analysis.Categories || [],
              actionItems: analysis["Action Items"] || [],
            }
          : null,
        entities: entityMap,
        analyzedAt: doc.scrapedAt?.toISOString() ?? null,
      };
    }),

  filterOptions: publicProcedure.query(async () => {
    const db = getDb();
    const [citiesRaw, sourcesRaw, categoriesRaw] = await Promise.all([
      db.selectDistinct({ city: documents.city }).from(documents),
      db.selectDistinct({ source: documents.source }).from(documents),
      db.selectDistinct({ category: documents.category }).from(documents),
    ]);
    const cities = citiesRaw.map((r) => r.city).filter(Boolean).sort();
    const sources = sourcesRaw.map((r) => r.source).filter(Boolean).sort();
    const categories = categoriesRaw.map((r) => r.category).filter(Boolean).sort();
    return { cities, sources, categories };
  }),
});
