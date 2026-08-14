import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { newsArticles, documents } from "../../drizzle/schema.js";
import { desc, eq, and, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm.js";
import { CITIES as REGION_CITIES, DOCUMENT_CATEGORIES } from "../../shared/region.js";

const CITIES = [...REGION_CITIES];
const CATEGORIES = [...DOCUMENT_CATEGORIES];

function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(w => { if (setB.has(w)) intersection++; });
  return intersection / (setA.size + setB.size - intersection);
}

function deduplicateArticles(articles: Record<string, unknown>[]): Record<string, unknown>[] {
  const THRESHOLD = 0.55;
  const kept: Record<string, unknown>[] = [];
  for (const article of articles) {
    const dup = kept.findIndex((e) =>
      textSimilarity(e.headline as string, article.headline as string) > THRESHOLD ||
      textSimilarity(e.summary as string, article.summary as string) > THRESHOLD
    );
    if (dup === -1) {
      kept.push(article);
    } else if ((article.importance as number || 0) > (kept[dup].importance as number || 0)) {
      kept[dup] = article;
    }
  }
  return kept;
}

async function filterExistingDuplicates(articles: Record<string, unknown>[], city: string): Promise<Record<string, unknown>[]> {
  const db = getDb();
  const existing = await db.select({ headline: newsArticles.headline, summary: newsArticles.summary })
    .from(newsArticles).where(eq(newsArticles.city, city)).limit(100);
  if (existing.length === 0) return articles;
  return articles.filter((article) =>
    !existing.some((ex) =>
      textSimilarity(ex.headline, article.headline as string) > 0.55 ||
      textSimilarity(ex.summary || "", article.summary as string) > 0.55
    )
  );
}

function cleanInlineIds(text: string): string {
  return text
    .replace(/\s*\[[0-9a-f]{20,}(?:,\s*[0-9a-f]{20,})*\]/gi, "")
    .replace(/\s*\[[0-9a-f]{20,}\]/gi, "");
}

export async function generateForCity(city: string, edition: string): Promise<{ articles: Record<string, unknown>[]; tokens: number }> {
  const db = getDb();
  // Group by content-extracted aboutCity (LLM-determined). Fall back to the
  // source.city for older docs that pre-date the aboutCity field. This makes
  // a Bee News story about Kingman appear in the Kingman edition rather than
  // the Bullhead City edition (where Bee News is filed as a source).
  const docs = await db.select().from(documents)
    .where(sql`COALESCE(${documents.aboutCity}, ${documents.city}) = ${city} AND ${documents.analysis} IS NOT NULL`)
    .orderBy(desc(documents.publishedAt))
    .limit(25);

  if (docs.length === 0) return { articles: [], tokens: 0 };

  const docContexts = docs.map((doc) => {
    const analysis = doc.analysis as Record<string, any> | null;
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      date: doc.publishedAt?.toISOString().split("T")[0] ?? "",
      summary: analysis?.Summary ?? "",
      sentiment: doc.sentiment ?? "neutral",
      sentimentScore: (analysis?.Sentiment?.Score as number | null) ?? 0,
      impact: analysis?.["Impact Level"] ?? "Medium",
      topics: (doc.topics as string[] | null) ?? [],
      actionItems: (analysis?.["Action Items"] as string[] | null) ?? [],
      content: doc.content.substring(0, 800),
    };
  });

  const systemPrompt = `You are a senior journalist for "The Cacti", an AI-powered local news publication covering Mohave County, Arizona. Transform civic data into compelling news articles.

CRITICAL RULES:
1. Every claim must be traceable to a source document. Include document IDs ONLY in the citationIds array, NEVER in article body text.
2. Do NOT embed document IDs or bracketed references in headline, summary, body, or whyItMatters fields.
3. Each article MUST cover a DISTINCT topic. Combine related documents into ONE article.
4. Return JSON with an "articles" array. Generate 4-7 articles.

isBreaking criteria — be STRICT. Default to false. Only mark isBreaking=true if the story describes ONE of:
- An active public-safety threat happening RIGHT NOW (active fire/flood/shooting/lockdown, ongoing health emergency, current power outage affecting >1000 residents)
- An imminent civic action within the next 48 hours (emergency declaration just issued, evacuation order, just-announced school closure, just-issued boil-water notice)
- Breaking news that materially affects daily life as of today (just-arrested suspect in a major case, just-confirmed outbreak, court ruling issued today on a high-stakes case)

NOT breaking (mark isBreaking=false even if the story is important):
- Ongoing investigations, cold cases, follow-ups on past events
- Scheduled council/board meetings, planned events, budget discussions
- Recaps, retrospectives, profile pieces, opinion content
- Contained incidents (e.g. "fire 78% contained", "cleanup underway")
- Stories where the most recent development is more than a few days old
- Routine community announcements, awards, recognitions, ceremonies

When in doubt, isBreaking is FALSE. The word "breaking" loses meaning if it's everywhere; readers tune out.

Each article:
{
  "headline": "Compelling headline (max 100 chars)",
  "summary": "1-2 sentence lede",
  "body": "Full article in markdown (3-8 paragraphs)",
  "whyItMatters": "1-2 sentences for Mohave County residents",
  "category": "one of: government, public_safety, infrastructure, environment, education, economy, community, health",
  "importance": number 1-10,
  "isBreaking": boolean,
  "citationIds": [array of document IDs as numbers]
}`;

  const userPrompt = `Generate news articles for ${city} from these ${docs.length} civic documents:

${docContexts.map((d, i) => `--- DOCUMENT ${i + 1} ---
ID: ${d.id}
Title: ${d.title}
Source: ${d.source} | Date: ${d.date} | Impact: ${d.impact} | Sentiment: ${d.sentiment}
Topics: ${d.topics.join(", ")}
Summary: ${d.summary}
Content: ${d.content}`).join("\n\n")}`;

  const result = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "news_articles",
        strict: true,
        schema: {
          type: "object",
          properties: {
            articles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  summary: { type: "string" },
                  body: { type: "string" },
                  whyItMatters: { type: "string" },
                  category: { type: "string" },
                  importance: { type: "integer" },
                  isBreaking: { type: "boolean" },
                  citationIds: { type: "array", items: { type: "integer" } },
                },
                required: ["headline", "summary", "body", "whyItMatters", "category", "importance", "isBreaking", "citationIds"],
                additionalProperties: false,
              },
            },
          },
          required: ["articles"],
          additionalProperties: false,
        },
      },
    },
  });

  const tokens = result.usage?.total_tokens || 0;

  let rawArticles: Record<string, unknown>[] = [];
  try {
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      rawArticles = (JSON.parse(content) as { articles: Record<string, unknown>[] }).articles || [];
    }
  } catch {
    return { articles: [], tokens };
  }

  const deduped = deduplicateArticles(rawArticles);
  const unique = await filterExistingDuplicates(deduped, city);

  const docLookup = new Map(docContexts.map((d) => [d.id, d]));
  const savedArticles: Record<string, unknown>[] = [];

  for (const article of unique) {
    const citationIds = article.citationIds as number[] | undefined ?? [];
    const citations = citationIds.map((id) => {
      const doc = docLookup.get(id);
      return doc
        ? { documentId: id, title: doc.title, source: doc.source, date: doc.date }
        : { documentId: id, title: "Unknown", source: "Unknown", date: "" };
    });

    const cat = CATEGORIES.includes(article.category as string) ? article.category as string : "community";
    const cleanBody = cleanInlineIds(article.body as string);
    const cleanSummary = cleanInlineIds(article.summary as string);
    const cleanHeadline = cleanInlineIds(article.headline as string).substring(0, 500);

    await db.insert(newsArticles).values({
      headline: cleanHeadline,
      summary: cleanSummary,
      body: cleanBody,
      whyItMatters: (article.whyItMatters as string | null) ?? null,
      city,
      category: cat,
      importance: Math.min(10, Math.max(1, (article.importance as number) || 5)),
      citations,
      metadata: { sentiment: docContexts[0]?.sentiment ?? "neutral", topics: Array.from(new Set(docContexts.flatMap((d) => d.topics))).slice(0, 10) },
      isBreaking: !!(article.isBreaking),
      edition,
      tokensUsed: Math.round(tokens / Math.max(rawArticles.length, 1)),
    });

    savedArticles.push({ ...article, city, edition, citations });
  }

  return { articles: savedArticles, tokens };
}

export const newsRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(30),
      city: z.string().optional(),
      category: z.string().optional(),
      edition: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      if (input.city) conditions.push(eq(newsArticles.city, input.city));
      if (input.category) conditions.push(eq(newsArticles.category, input.category));
      if (input.edition) conditions.push(eq(newsArticles.edition, input.edition));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return await (where
        ? db.select().from(newsArticles).where(where)
        : db.select().from(newsArticles)
      ).orderBy(desc(newsArticles.importance), desc(newsArticles.createdAt)).limit(input.limit);
    }),

  detail: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [row] = await getDb().select().from(newsArticles).where(eq(newsArticles.id, input.id)).limit(1);
      return row ?? null;
    }),

  editions: publicProcedure.query(async () => {
    const db = getDb();
    const all = await db.select({ edition: newsArticles.edition, city: newsArticles.city })
      .from(newsArticles).orderBy(desc(newsArticles.createdAt));
    const editionMap: Record<string, { edition: string; cities: Set<string>; count: number }> = {};
    for (const row of all) {
      if (!editionMap[row.edition]) editionMap[row.edition] = { edition: row.edition, cities: new Set(), count: 0 };
      editionMap[row.edition].cities.add(row.city);
      editionMap[row.edition].count++;
    }
    return Object.values(editionMap).map((e) => ({
      edition: e.edition,
      cities: Array.from(e.cities),
      articleCount: e.count,
    }));
  }),

  generate: adminProcedure
    .input(z.object({ city: z.string().optional() }))
    .mutation(async ({ input }) => {
      const edition = new Date().toISOString().split("T")[0];
      const citiesToGenerate = input.city ? [input.city] : CITIES;
      const allArticles: Record<string, unknown>[] = [];
      let totalTokens = 0;

      for (const city of citiesToGenerate) {
        const result = await generateForCity(city, edition);
        allArticles.push(...result.articles);
        totalTokens += result.tokens;
      }

      return { success: true, edition, articleCount: allArticles.length, cities: citiesToGenerate, totalTokens };
    }),

  generateAll: adminProcedure.mutation(async () => {
    const edition = new Date().toISOString().split("T")[0];
    const allArticles: Record<string, unknown>[] = [];
    let totalTokens = 0;
    const results: Record<string, number> = {};

    for (const city of CITIES) {
      const result = await generateForCity(city, edition);
      allArticles.push(...result.articles);
      totalTokens += result.tokens;
      results[city] = result.articles.length;
    }

    return { success: true, edition, articleCount: allArticles.length, cities: CITIES, cityCounts: results, totalTokens };
  }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(newsArticles).where(eq(newsArticles.id, input.id));
      return { success: true };
    }),

  deleteEdition: adminProcedure
    .input(z.object({ edition: z.string() }))
    .mutation(async ({ input }) => {
      await getDb().delete(newsArticles).where(eq(newsArticles.edition, input.edition));
      return { success: true };
    }),

  clearCity: adminProcedure
    .input(z.object({ city: z.string() }))
    .mutation(async ({ input }) => {
      await getDb().delete(newsArticles).where(eq(newsArticles.city, input.city));
      return { success: true };
    }),
});
