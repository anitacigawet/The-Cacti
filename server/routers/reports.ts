import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { generatedReports, documents } from "../../drizzle/schema.js";
import { desc, eq, sql, and, lte } from "drizzle-orm";
import { visibilityCutoff } from "../_core/visibility.js";
import { invokeLLM } from "../_core/llm.js";

const REGION_TIMEZONE = "America/Phoenix";

function regionDateISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: REGION_TIMEZONE });
}

export const reportsRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      type: z.enum(["daily", "weekly", "custom", "all"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      return await db.select().from(generatedReports).where(and(
        lte(generatedReports.createdAt, visibilityCutoff(ctx.user)),
        input.type === "all" ? undefined : eq(generatedReports.type, input.type)
      )).orderBy(desc(generatedReports.createdAt)).limit(input.limit);
    }),

  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [row] = await getDb().select().from(generatedReports).where(and(eq(generatedReports.id, input.id), lte(generatedReports.createdAt, visibilityCutoff(ctx.user)))).limit(1);
      return row ?? null;
    }),

  generateDaily: adminProcedure.mutation(async () => {
    const db = getDb();
    const docs = await db.select().from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`)
      .orderBy(desc(documents.publishedAt))
      .limit(40);

    if (docs.length === 0) {
      return { success: false, message: "No analyzed documents available for report generation" };
    }

    const cityBreakdown: Record<string, number> = {};
    const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    const impactCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    const allTopics: Record<string, number> = {};
    const highImpactItems: string[] = [];

    const contextParts = docs.map((doc) => {
      const analysis = doc.analysis as Record<string, any> | null;
      const sentiment = doc.sentiment ?? "neutral";
      const impact = analysis?.["Impact Level"] ?? "Medium";

      cityBreakdown[doc.city] = (cityBreakdown[doc.city] || 0) + 1;
      if (sentiment in sentimentCounts) sentimentCounts[sentiment]++;
      if (impact in impactCounts) impactCounts[impact]++;

      for (const t of (doc.topics as string[] | null) ?? []) {
        const k = t.trim();
        if (k) allTopics[k] = (allTopics[k] || 0) + 1;
      }

      if (impact === "High") highImpactItems.push(`- ${doc.title} (${doc.city}, ${sentiment})`);

      return `[${doc.city} | ${doc.source} | ${doc.publishedAt?.toISOString().split("T")[0] ?? ""}]
Title: ${doc.title}
Summary: ${analysis?.Summary ?? "No summary"}
Sentiment: ${sentiment} (Score: ${analysis?.Sentiment?.Score ?? "N/A"})
Impact: ${impact}
Topics: ${(doc.topics as string[] | null)?.join(", ") ?? ""}`;
    });

    const topTopics = Object.entries(allTopics)
      .sort(([, a], [, b]) => b - a).slice(0, 15)
      .map(([topic, count]) => `${topic} (${count})`);

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Cacti, a civic intelligence analysis system for Mohave County, Arizona. Generate a comprehensive Daily Intelligence Brief. Structure: 1. EXECUTIVE SUMMARY 2. HIGH-PRIORITY ITEMS 3. CITY-BY-CITY ANALYSIS 4. SENTIMENT & TREND ANALYSIS 5. THREAT ASSESSMENT 6. KEY TOPICS & THEMES 7. RECOMMENDATIONS. Use professional intelligence briefing language. Format in clean Markdown.`,
        },
        {
          role: "user",
          content: `Generate a Daily Intelligence Brief for ${regionDateISO()}.

DATA SUMMARY:
- Total documents: ${docs.length}
- Cities: ${Object.entries(cityBreakdown).map(([c, n]) => `${c}: ${n}`).join(", ")}
- Sentiment: Positive ${sentimentCounts.positive}, Neutral ${sentimentCounts.neutral}, Negative ${sentimentCounts.negative}
- Impact: High ${impactCounts.High}, Medium ${impactCounts.Medium}, Low ${impactCounts.Low}
- Top topics: ${topTopics.join(", ")}

HIGH-IMPACT ITEMS:
${highImpactItems.length > 0 ? highImpactItems.join("\n") : "None identified"}

FULL DOCUMENT CONTEXT:
${contextParts.join("\n\n---\n\n")}`,
        },
      ],
    });

    const content = typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "Report generation failed.";
    const tokensUsed = result.usage?.total_tokens || 0;
    const title = `Daily Intelligence Brief - ${regionDateISO()}`;

    await db.insert(generatedReports).values({
      type: "daily",
      title,
      content,
      metadata: { documentCount: docs.length, cityBreakdown, sentimentCounts, impactCounts, topTopics: topTopics.slice(0, 10), generatedAt: new Date().toISOString() },
      tokensUsed,
    });

    return { success: true, title, content, tokensUsed, documentCount: docs.length };
  }),

  generateWeekly: adminProcedure.mutation(async () => {
    const db = getDb();
    const docs = await db.select().from(documents)
      .where(sql`${documents.analysis} IS NOT NULL`)
      .orderBy(desc(documents.publishedAt))
      .limit(100);

    if (docs.length === 0) {
      return { success: false, message: "No analyzed documents available" };
    }

    const cityBreakdown: Record<string, number> = {};
    const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    const impactCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    const allTopics: Record<string, number> = {};
    const sourceBreakdown: Record<string, number> = {};
    const summaries: string[] = [];

    for (const doc of docs) {
      const analysis = doc.analysis as Record<string, any> | null;
      const sentiment = doc.sentiment ?? "neutral";
      const impact = analysis?.["Impact Level"] ?? "Medium";

      cityBreakdown[doc.city] = (cityBreakdown[doc.city] || 0) + 1;
      sourceBreakdown[doc.source] = (sourceBreakdown[doc.source] || 0) + 1;
      if (sentiment in sentimentCounts) sentimentCounts[sentiment]++;
      if (impact in impactCounts) impactCounts[impact]++;
      for (const t of (doc.topics as string[] | null) ?? []) {
        const k = t.trim();
        if (k) allTopics[k] = (allTopics[k] || 0) + 1;
      }
      summaries.push(`[${doc.city}/${doc.source}] ${doc.title}: ${analysis?.Summary ?? "No summary"} (${sentiment}, ${impact})`);
    }

    const topTopics = Object.entries(allTopics)
      .sort(([, a], [, b]) => b - a).slice(0, 20)
      .map(([topic, count]) => `${topic} (${count})`);

    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Cacti, a civic intelligence analysis system for Mohave County, Arizona. Generate a comprehensive Weekly Intelligence Report. Sections: 1. WEEKLY EXECUTIVE SUMMARY 2. STATISTICAL OVERVIEW 3. HIGH-PRIORITY DEVELOPMENTS 4. CITY PROFILES 5. SOURCE RELIABILITY ASSESSMENT 6. TREND ANALYSIS 7. THREAT MATRIX 8. STRATEGIC RECOMMENDATIONS 9. OUTLOOK. Format in clean Markdown with tables where appropriate.`,
        },
        {
          role: "user",
          content: `Generate a Weekly Intelligence Report for the week ending ${regionDateISO()}.

AGGREGATE DATA:
- Total documents: ${docs.length}
- Cities: ${Object.entries(cityBreakdown).map(([c, n]) => `${c} (${n})`).join(", ")}
- Sources: ${Object.entries(sourceBreakdown).map(([s, n]) => `${s} (${n})`).join(", ")}
- Sentiment: Positive ${sentimentCounts.positive}, Neutral ${sentimentCounts.neutral}, Negative ${sentimentCounts.negative}
- Impact: High ${impactCounts.High}, Medium ${impactCounts.Medium}, Low ${impactCounts.Low}
- Top themes: ${topTopics.join(", ")}

DOCUMENT SUMMARIES:
${summaries.join("\n")}`,
        },
      ],
    });

    const content = typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "Report generation failed.";
    const tokensUsed = result.usage?.total_tokens || 0;
    const title = `Weekly Intelligence Report - Week ending ${regionDateISO()}`;

    await db.insert(generatedReports).values({
      type: "weekly",
      title,
      content,
      metadata: { documentCount: docs.length, cityBreakdown, sentimentCounts, impactCounts, sourceBreakdown, topTopics: topTopics.slice(0, 15), generatedAt: new Date().toISOString() },
      tokensUsed,
    });

    return { success: true, title, content, tokensUsed, documentCount: docs.length };
  }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(generatedReports).where(eq(generatedReports.id, input.id));
      return { success: true };
    }),
});
