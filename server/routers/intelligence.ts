import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { documents } from "../../drizzle/schema.js";
import { invokeLLM } from "../_core/llm.js";
import { intelligenceSystemPrompt } from "../_core/llm/prompts/intelligence-system.js";
import { normalizeImpact } from "../_core/impact.js";
import { sql, desc } from "drizzle-orm";

export const intelligenceRouter = router({
  query: adminProcedure
    .input(z.object({ question: z.string().min(1).max(1000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const docs = await db
        .select()
        .from(documents)
        .where(sql`${documents.analysis} IS NOT NULL`)
        .orderBy(desc(documents.publishedAt))
        .limit(30);

      const contextParts = docs.map((doc) => {
        const analysis = doc.analysis as Record<string, any> | null;
        return `[${doc.city} | ${doc.source} | ${doc.publishedAt?.toISOString().split("T")[0] ?? ""}]
Title: ${doc.title}
Summary: ${analysis?.Summary ?? doc.content.substring(0, 200)}
Sentiment: ${doc.sentiment ?? "unknown"} (${analysis?.Sentiment?.Score ?? "N/A"})
Impact: ${analysis?.["Impact Level"] ?? "Unknown"}
Topics: ${(doc.topics as string[] | null)?.join(", ") ?? ""}`;
      });

      const systemPrompt = `${intelligenceSystemPrompt(docs.length)}

Available civic data context:
${contextParts.join("\n\n---\n\n")}`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.question },
        ],
      });

      const answer =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";

      return {
        answer,
        tokensUsed: result.usage?.total_tokens || 0,
        sourcesConsulted: docs.length,
        model: result.model || "unknown",
      };
    }),

  dailyBrief: adminProcedure.query(async () => {
    const db = getDb();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentDocs = await db
      .select()
      .from(documents)
      .where(
        sql`${documents.analysis} IS NOT NULL AND ${documents.publishedAt} >= ${oneDayAgo}`
      )
      .orderBy(desc(documents.publishedAt))
      .limit(20);

    const source = recentDocs.length > 0
      ? recentDocs
      : await db
          .select()
          .from(documents)
          .where(sql`${documents.analysis} IS NOT NULL`)
          .orderBy(desc(documents.publishedAt))
          .limit(10);

    const items = source.map((doc) => {
      const analysis = doc.analysis as Record<string, any> | null;
      return {
        id: doc.id,
        title: doc.title,
        city: doc.city,
        summary: analysis?.Summary ?? "",
        sentiment: doc.sentiment ?? "neutral",
        impactLevel: normalizeImpact(analysis?.["Impact Level"]) ?? "Medium",
      };
    });

    return {
      date: new Date().toISOString().split("T")[0],
      totalDocuments: items.length,
      items,
      generated: recentDocs.length > 0,
      message:
        recentDocs.length > 0
          ? `${recentDocs.length} new intelligence items in the last 24 hours`
          : "Showing most recent intelligence items (no new items in last 24h)",
    };
  }),

  alerts: adminProcedure
    .input(
      z.object({
        status: z.enum(["active", "acknowledged", "all"]).default("active"),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const docs = await db
        .select()
        .from(documents)
        .where(sql`${documents.analysis} IS NOT NULL`)
        .orderBy(desc(documents.publishedAt));

      const alerts: {
        id: number;
        title: string;
        city: string;
        type: string;
        severity: string;
        summary: string;
        publishedDate: string;
        source: string;
      }[] = [];

      for (const doc of docs) {
        const analysis = doc.analysis as Record<string, any> | null;
        if (!analysis) continue;

        const impact = analysis["Impact Level"] ?? "Medium";
        const sentiment = doc.sentiment ?? "neutral";
        const score = (analysis.Sentiment?.Score as number | null) ?? 0.5;
        const stronglyNegative = score < 0.2;

        // Derived legacy alerts: a doc qualifies only when its signal is
        // strong enough to actually warrant attention. Tightened from
        // `score < 0.3` (caught mildly-negative content as critical) so the
        // alerts surface only deeply-negative or actually-high-impact items.
        let alertType: string | null = null;
        let severity = "info";

        if (impact === "High") { alertType = "high_impact"; severity = "warning"; }
        if (stronglyNegative) { alertType = "negative_sentiment"; severity = "warning"; }
        if (impact === "High" && (sentiment === "negative" && stronglyNegative)) { alertType = "critical_event"; severity = "critical"; }

        if (alertType) {
          alerts.push({
            id: doc.id,
            title: doc.title,
            city: doc.city,
            type: alertType,
            severity,
            summary: analysis.Summary ?? "",
            publishedDate: doc.publishedAt?.toISOString() ?? doc.scrapedAt?.toISOString() ?? "",
            source: doc.source,
          });
        }
      }

      return alerts.slice(0, input.limit);
    }),
});
