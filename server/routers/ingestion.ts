import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc.js";
import { getDb } from "../db.js";
import {
  ingestionSources,
  ingestionRuns,
  ingestionSchedule,
  documents,
  documentEntities,
} from "../../drizzle/schema.js";
import { desc, eq, sql, gte } from "drizzle-orm";
import { loadDataSources } from "../utils/load-data-sources.js";
import { invokeLLM } from "../_core/llm.js";
import { scrapeRSS, scrapeWebpage } from "../utils/source-parsers.js";
import { generateForCity } from "./news.js";
import { CITIES as REGION_CITIES } from "../../shared/region.js";

/**
 * Cheap pre-flight check: is this article primarily about Arizona at all?
 * Used to short-circuit the full analyze() pipeline for out-of-state content
 * before we spend tokens classifying / extracting entities on docs we'll
 * never surface. Small feeds (Mohave Daily News, Kingman Daily Miner,
 * Arizona Daily Sun) publish a lot of national wire content — without this
 * filter ~42% of ingested docs would be dead weight.
 *
 * Returns { isArizona: true } on parse failure — fail-open is safer than
 * silently dropping legitimate Arizona content if the LLM hiccups.
 */
export async function isAboutArizona(title: string, content: string): Promise<{ isArizona: boolean; tokens: number }> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a quick relevance filter for an Arizona civic intelligence system. Decide whether an article is primarily about Arizona. Be strict — incidental mentions of Arizona or an Arizona person don't count. The article must be about an event, decision, place, or institution IN Arizona. Return JSON only.",
      },
      {
        role: "user",
        content: `Title: ${title}\n\nContent (truncated): ${content.substring(0, 1500)}\n\nIs this article PRIMARILY about Arizona (any city, county, statewide story, or an event happening in Arizona)? Return JSON: { "IsArizona": boolean }.\n\nYes examples:\n- Phoenix housing prices, Tucson police shooting, Mohave County wildfire\n- State legislation, Arizona governor's actions, AZ Department of X policy\n- An Arizona senator acting specifically on Arizona issues\n\nNo examples:\n- National congressional news with no Arizona angle\n- A foreign event mentioned by an Arizona outlet\n- An Arizona resident traveling to another state for an unrelated reason\n- A story that mentions Arizona only in passing or in a list`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "arizona_filter",
        strict: true,
        schema: {
          type: "object",
          properties: { IsArizona: { type: "boolean" } },
          required: ["IsArizona"],
          additionalProperties: false,
        },
      },
    },
  });
  const tokens = result.usage?.total_tokens || 0;
  const c = result.choices[0]?.message?.content;
  if (typeof c === "string") {
    try {
      const parsed = JSON.parse(c) as { IsArizona?: boolean };
      return { isArizona: parsed.IsArizona === true, tokens };
    } catch {
      /* fall through to fail-open */
    }
  }
  return { isArizona: true, tokens };
}

async function analyzeDocument(doc: {
  title: string;
  content: string;
  source: string;
  city: string;
}): Promise<{ analysis: Record<string, unknown>; entities: Record<string, string[]>; tokens: number }> {
  const analysisResult = await invokeLLM({
    messages: [
      { role: "system", content: "You are a civic intelligence analyst. Analyze documents and extract structured data. Return valid JSON only." },
      {
        role: "user",
        content: `Analyze this civic document. Source-region (where the publishing source is based): ${doc.city}, Mohave County, Arizona.

Title: ${doc.title}
Source: ${doc.source}
Content: ${doc.content.substring(0, 4000)}

Return a JSON analysis with these exact fields:
{
  "Summary": "2-3 sentence summary",
  "Key Topics": ["array of key topics"],
  "Sentiment": { "Overall": "positive|negative|neutral|mixed", "Score": number from -1 to 1 },
  "Impact Level": "High|Medium|Low",
  "Categories": ["array of categories"],
  "Action Items": ["array of action items"],
  "Key Dates": ["array of dates"],
  "Stakeholders": ["array of people/organizations"],
  "AboutCity": "the place this article is PRIMARILY ABOUT — exactly one of these enum values. Mohave County (primary coverage): 'Kingman' / 'Bullhead City' / 'Lake Havasu City' ONLY when centrally about events/people/institutions in that specific city. 'Mohave County' for county-wide stories OR smaller Mohave places (Fort Mohave, Mohave Valley, Laughlin, Golden Valley). Arizona Wire (for the Across Arizona section): 'Phoenix Metro' (Phoenix, Scottsdale, Tempe, Mesa, Chandler, Gilbert, Glendale, Peoria, Goodyear, Surprise, Avondale, Buckeye, Maricopa, Apache Junction, Queen Creek, any other Maricopa County city). 'Flagstaff Area' (Flagstaff, Sedona, Williams, Page, Coconino County). 'Tucson Metro' (Tucson, Marana, Oro Valley, Sahuarita, Pima County). 'Other Arizona' for anywhere else in Arizona (Prescott, Yuma, Sierra Vista, statewide stories not fitting a specific metro). Out of region: 'Out of State' for anywhere outside Arizona (national news, other states, international). Be strict: an Arizona resident traveling out of state is NOT an Arizona story. A national story that mentions an Arizona person briefly is 'Out of State'. Pick based on where the event/story takes place, not where the source is based."
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "civic_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            Summary: { type: "string" },
            "Key Topics": { type: "array", items: { type: "string" } },
            Sentiment: { type: "object", properties: { Overall: { type: "string" }, Score: { type: "number" } }, required: ["Overall", "Score"], additionalProperties: false },
            "Impact Level": { type: "string" },
            Categories: { type: "array", items: { type: "string" } },
            "Action Items": { type: "array", items: { type: "string" } },
            "Key Dates": { type: "array", items: { type: "string" } },
            Stakeholders: { type: "array", items: { type: "string" } },
            AboutCity: { type: "string", enum: ["Kingman", "Bullhead City", "Lake Havasu City", "Mohave County", "Phoenix Metro", "Flagstaff Area", "Tucson Metro", "Other Arizona", "Out of State"] },
          },
          required: ["Summary", "Key Topics", "Sentiment", "Impact Level", "Categories", "Action Items", "Key Dates", "Stakeholders", "AboutCity"],
          additionalProperties: false,
        },
      },
    },
  });

  const analysisTokens = analysisResult.usage?.total_tokens || 0;
  let analysis: Record<string, unknown> = {};
  try {
    const c = analysisResult.choices[0]?.message?.content;
    if (typeof c === "string") analysis = JSON.parse(c);
  } catch { /* use empty */ }

  const entityResult = await invokeLLM({
    messages: [
      { role: "system", content: "Extract named entities from civic documents. Return valid JSON only." },
      {
        role: "user",
        content: `Extract named entities from this civic document:

Title: ${doc.title}
Content: ${doc.content.substring(0, 3000)}

Return JSON:
{
  "People": ["names of people"],
  "Organizations": ["organizations"],
  "Locations": ["locations"],
  "Dates": ["dates"],
  "Monetary": ["dollar amounts"]
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "entity_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            People: { type: "array", items: { type: "string" } },
            Organizations: { type: "array", items: { type: "string" } },
            Locations: { type: "array", items: { type: "string" } },
            Dates: { type: "array", items: { type: "string" } },
            Monetary: { type: "array", items: { type: "string" } },
          },
          required: ["People", "Organizations", "Locations", "Dates", "Monetary"],
          additionalProperties: false,
        },
      },
    },
  });

  const entityTokens = entityResult.usage?.total_tokens || 0;
  let entities: Record<string, string[]> = { People: [], Organizations: [], Locations: [], Dates: [], Monetary: [] };
  try {
    const c = entityResult.choices[0]?.message?.content;
    if (typeof c === "string") entities = JSON.parse(c);
  } catch { /* use empty */ }

  return { analysis, entities, tokens: analysisTokens + entityTokens };
}

async function documentExists(url: string, title: string): Promise<boolean> {
  const db = getDb();
  if (url) {
    const byUrl = await db.select({ id: documents.id }).from(documents).where(eq(documents.url, url)).limit(1);
    if (byUrl.length > 0) return true;
  }
  const escaped = title.replace(/[%_]/g, "\\$&");
  const byTitle = await db.select({ id: documents.id }).from(documents).where(sql`${documents.title} LIKE ${escaped}`).limit(1);
  return byTitle.length > 0;
}

async function storeDocument(doc: {
  title: string;
  content: string;
  source: string;
  url: string;
  category: string;
  city: string;
  publishedDate: string;
  analysis: Record<string, unknown>;
  entities: Record<string, string[]>;
}): Promise<number> {
  const db = getDb();
  const sentiment = (doc.analysis?.Sentiment as { Overall?: string } | undefined)?.Overall?.toLowerCase() ?? null;
  const impactRaw = doc.analysis?.["Impact Level"] as string | undefined;
  const impactLevel = impactRaw === "High" ? 1 : impactRaw === "Low" ? 0 : null;
  const topics = (doc.analysis?.["Key Topics"] as string[] | undefined) ?? null;

  // The LLM returns AboutCity as one of the Mohave cities, an Arizona Wire
  // metro (Phoenix/Flagstaff/Tucson/Other Arizona), or 'Out of State'. Trust
  // any of these; fall back to source.city only when the field is missing
  // entirely (older analyses pre-dating the field). The Newspaper page
  // groups Mohave editions as the primary surface and Arizona Wire as a
  // secondary "Across Arizona" section. 'Out of State' docs stay queryable
  // in the Documents view but don't match any newspaper edition.
  const llmAboutCity = doc.analysis?.AboutCity as string | undefined;
  const VALID_CITIES = [
    "Kingman",
    "Bullhead City",
    "Lake Havasu City",
    "Mohave County",
    "Phoenix Metro",
    "Flagstaff Area",
    "Tucson Metro",
    "Other Arizona",
    "Out of State",
  ];
  const aboutCity = llmAboutCity && VALID_CITIES.includes(llmAboutCity) ? llmAboutCity : doc.city;

  const [row] = await db.insert(documents).values({
    url: doc.url || `${doc.source}::${doc.title}::${Date.now()}`,
    title: doc.title,
    content: doc.content,
    source: doc.source,
    city: doc.city,
    aboutCity,
    category: doc.category,
    publishedAt: doc.publishedDate ? new Date(doc.publishedDate) : null,
    analysis: doc.analysis,
    sentiment,
    impactLevel,
    topics,
  }).returning({ id: documents.id });

  const docId = row.id;

  // Store entities
  const TYPE_MAP: Record<string, string> = {
    People: "person",
    Organizations: "organization",
    Locations: "location",
    Dates: "date",
    Monetary: "money",
  };

  for (const [type, names] of Object.entries(doc.entities)) {
    const entityType = TYPE_MAP[type] || type.toLowerCase();
    for (const name of names) {
      const n = String(name).trim();
      if (n.length >= 2) {
        await db.insert(documentEntities).values({
          documentId: docId,
          name: n,
          type: entityType,
          city: doc.city,
        });
      }
    }
  }

  return docId;
}

export const ingestionRouter = router({
  listSources: adminProcedure.query(async () => {
    return await getDb().select().from(ingestionSources).orderBy(desc(ingestionSources.createdAt));
  }),

  addSource: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.enum(["rss", "webpage", "api", "sitemap"]),
        city: z.string().min(1),
        category: z.string().min(1),
        sourceLabel: z.string().min(1),
        intervalMinutes: z.number().min(30).default(360),
        config: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [row] = await getDb().insert(ingestionSources).values({
        name: input.name,
        url: input.url,
        type: input.type,
        city: input.city,
        category: input.category,
        sourceLabel: input.sourceLabel,
        intervalMinutes: input.intervalMinutes,
        config: input.config ?? null,
      }).returning({ id: ingestionSources.id });
      return { id: row.id };
    }),

  updateSource: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        url: z.string().url().optional(),
        enabled: z.boolean().optional(),
        intervalMinutes: z.number().min(30).optional(),
        config: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.url !== undefined) updates.url = input.url;
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.intervalMinutes !== undefined) updates.intervalMinutes = input.intervalMinutes;
      if (input.config !== undefined) updates.config = input.config;

      await getDb().update(ingestionSources).set(updates).where(eq(ingestionSources.id, input.id));
      return { success: true };
    }),

  deleteSource: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(ingestionSources).where(eq(ingestionSources.id, input.id));
      return { success: true };
    }),

  listRuns: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      return await getDb().select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(input?.limit ?? 20);
    }),

  runSource: adminProcedure
    .input(z.object({ sourceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [source] = await db.select().from(ingestionSources).where(eq(ingestionSources.id, input.sourceId));
      if (!source) throw new Error("Source not found");

      const [runRow] = await db.insert(ingestionRuns).values({
        sourceId: source.id,
        trigger: "manual",
        status: "running",
      }).returning({ id: ingestionRuns.id });
      const runId = runRow.id;

      const logEntries: string[] = [];
      let docsFound = 0;
      let docsAnalyzed = 0;
      let totalTokens = 0;

      try {
        logEntries.push(`Starting ingestion for source: ${source.name} (${source.type})`);

        let scrapedItems: Array<{ title: string; content: string; link: string; date: string }> = [];

        if (source.type === "rss") {
          scrapedItems = await scrapeRSS(source.url);
          logEntries.push(`RSS feed returned ${scrapedItems.length} items`);
        } else if (source.type === "webpage") {
          const pageData = await scrapeWebpage(source.url);
          scrapedItems = [{ title: pageData.title, content: pageData.content, link: source.url, date: new Date().toISOString() }];
          logEntries.push(`Webpage scraped: ${pageData.title}`);
        }

        docsFound = scrapedItems.length;

        for (const item of scrapedItems) {
          try {
            if (await documentExists(item.link, item.title)) {
              logEntries.push(`SKIP (duplicate): ${item.title}`);
              continue;
            }

            const preflight = await isAboutArizona(item.title, item.content);
            totalTokens += preflight.tokens;
            if (!preflight.isArizona) {
              logEntries.push(`SKIP (non-Arizona): ${item.title}`);
              continue;
            }

            logEntries.push(`Analyzing: ${item.title}`);
            const { analysis, entities, tokens } = await analyzeDocument({
              title: item.title,
              content: item.content,
              source: source.sourceLabel,
              city: source.city,
            });
            totalTokens += tokens;

            const docId = await storeDocument({
              title: item.title,
              content: item.content,
              source: source.sourceLabel,
              url: item.link,
              category: source.category,
              city: source.city,
              publishedDate: item.date,
              analysis,
              entities,
            });

            docsAnalyzed++;
            logEntries.push(`STORED: ${item.title} → id:${docId}`);
          } catch (itemErr: unknown) {
            logEntries.push(`ERROR processing "${item.title}": ${(itemErr as Error).message}`);
          }
        }

        await db.update(ingestionSources).set({
          lastScrapedAt: new Date(),
          documentCount: sql`${ingestionSources.documentCount} + ${docsAnalyzed}`,
          lastError: null,
          consecutiveFailures: 0,
          healthStatus: "healthy",
        }).where(eq(ingestionSources.id, source.id));

        await db.update(ingestionRuns).set({
          status: "completed",
          documentsFound: docsFound,
          documentsAnalyzed: docsAnalyzed,
          tokensUsed: totalTokens,
          log: logEntries,
          completedAt: new Date(),
        }).where(eq(ingestionRuns.id, runId));

        return { runId, documentsFound: docsFound, documentsAnalyzed: docsAnalyzed, tokensUsed: totalTokens, log: logEntries };
      } catch (err: unknown) {
        await db.update(ingestionRuns).set({
          status: "failed",
          errorMessage: (err as Error).message,
          log: logEntries,
          completedAt: new Date(),
        }).where(eq(ingestionRuns.id, runId));

        const [curSrc] = await db.select().from(ingestionSources).where(eq(ingestionSources.id, source.id));
        const newFailures = (curSrc?.consecutiveFailures ?? 0) + 1;
        const newHealth = newFailures >= 5 ? "offline" : newFailures >= 3 ? "failing" : newFailures >= 2 ? "degraded" : "healthy";
        await db.update(ingestionSources).set({
          lastError: (err as Error).message,
          consecutiveFailures: newFailures,
          healthStatus: newHealth,
          ...(newFailures >= 5 ? { enabled: false } : {}),
        }).where(eq(ingestionSources.id, source.id));

        if (newFailures >= 3) {
          const hrsSince = curSrc?.lastAlertSentAt
            ? (Date.now() - new Date(curSrc.lastAlertSentAt).getTime()) / 3600000
            : 999;
          if (hrsSince > 6) {
            try {
              const { notifyOwner } = await import("../_core/notification.js");
              await notifyOwner({
                title: `⚠️ Cacti Source Health Alert: ${source.name}`,
                content: `Source "${source.name}" (${source.url}) failed ${newFailures} times.\nError: ${(err as Error).message}\nStatus: ${newHealth.toUpperCase()}`,
              });
              await db.update(ingestionSources).set({ lastAlertSentAt: new Date() }).where(eq(ingestionSources.id, source.id));
            } catch { /* best-effort */ }
          }
        }

        throw new Error(`Ingestion failed: ${(err as Error).message}`);
      }
    }),

  runPipeline: adminProcedure
    .input(z.object({ generateNews: z.boolean().default(true) }).optional())
    .mutation(async ({ input }) => {
      const db = getDb();
      const sources = await db.select().from(ingestionSources).where(eq(ingestionSources.enabled, true));

      if (sources.length === 0) {
        return { message: "No enabled sources configured", sourcesProcessed: 0, totalDocuments: 0, totalTokens: 0 };
      }

      const [runRow] = await db.insert(ingestionRuns).values({ trigger: "manual", status: "running" }).returning({ id: ingestionRuns.id });
      const runId = runRow.id;

      let totalDocsFound = 0;
      let totalDocsAnalyzed = 0;
      let totalTokens = 0;
      let articlesGenerated = 0;
      let failures = 0;
      const logEntries: string[] = [`Pipeline started: ${sources.length} sources to process`];

      for (const source of sources) {
        let sourceDocsAnalyzed = 0;
        try {
          logEntries.push(`\n--- Processing: ${source.name} (${source.type}) ---`);
          let scrapedItems: Array<{ title: string; content: string; link: string; date: string }> = [];

          if (source.type === "rss") {
            scrapedItems = await scrapeRSS(source.url);
          } else if (source.type === "webpage") {
            const pageData = await scrapeWebpage(source.url);
            scrapedItems = [{ title: pageData.title, content: pageData.content, link: source.url, date: new Date().toISOString() }];
          }

          totalDocsFound += scrapedItems.length;

          for (const item of scrapedItems) {
            try {
              if (await documentExists(item.link, item.title)) {
                logEntries.push(`SKIP: ${item.title}`);
                continue;
              }
              const preflight = await isAboutArizona(item.title, item.content);
              totalTokens += preflight.tokens;
              if (!preflight.isArizona) {
                logEntries.push(`SKIP (non-Arizona): ${item.title}`);
                continue;
              }
              const { analysis, entities, tokens } = await analyzeDocument({
                title: item.title, content: item.content, source: source.sourceLabel, city: source.city,
              });
              totalTokens += tokens;
              await storeDocument({
                title: item.title, content: item.content, source: source.sourceLabel, url: item.link,
                category: source.category, city: source.city, publishedDate: item.date, analysis, entities,
              });
              totalDocsAnalyzed++;
              sourceDocsAnalyzed++;
              logEntries.push(`STORED: ${item.title}`);
            } catch (itemErr: unknown) {
              failures++;
              logEntries.push(`ERROR: ${item.title} - ${(itemErr as Error).message}`);
            }
          }

          await db.update(ingestionSources).set({
            lastScrapedAt: new Date(),
            documentCount: sql`${ingestionSources.documentCount} + ${sourceDocsAnalyzed}`,
            lastError: null, consecutiveFailures: 0, healthStatus: "healthy",
          }).where(eq(ingestionSources.id, source.id));
        } catch (sourceErr: unknown) {
          failures++;
          logEntries.push(`SOURCE FAILED: ${source.name} - ${(sourceErr as Error).message}`);
          const [curSrc] = await db.select().from(ingestionSources).where(eq(ingestionSources.id, source.id));
          const fails = (curSrc?.consecutiveFailures ?? 0) + 1;
          const health = fails >= 5 ? "offline" : fails >= 3 ? "failing" : fails >= 2 ? "degraded" : "healthy";
          await db.update(ingestionSources).set({
            lastError: (sourceErr as Error).message, consecutiveFailures: fails, healthStatus: health,
            ...(fails >= 5 ? { enabled: false } : {}),
          }).where(eq(ingestionSources.id, source.id));
        }
      }

      if ((input?.generateNews ?? true) && totalDocsAnalyzed > 0) {
        const edition = new Date().toISOString().split("T")[0];
        for (const city of REGION_CITIES) {
          try {
            const generated = await generateForCity(city, edition);
            articlesGenerated += generated.articles.length;
            totalTokens += generated.tokens;
            logEntries.push(`NEWS: ${city}: ${generated.articles.length} articles`);
          } catch (error) {
            failures++;
            logEntries.push(`NEWS FAILED: ${city} - ${(error as Error).message}`);
          }
        }
      }

      await db.update(ingestionRuns).set({
        status: failures > 0 ? "partial" : "completed",
        documentsFound: totalDocsFound,
        documentsAnalyzed: totalDocsAnalyzed,
        articlesGenerated,
        tokensUsed: totalTokens,
        log: logEntries,
        completedAt: new Date(),
      }).where(eq(ingestionRuns.id, runId));

      await db.update(ingestionSchedule).set({ lastRunAt: new Date() }).where(eq(ingestionSchedule.id, 1));

      return { runId, sourcesProcessed: sources.length, totalDocumentsFound: totalDocsFound, totalDocumentsAnalyzed: totalDocsAnalyzed, articlesGenerated, totalTokens, log: logEntries };
    }),

  getSchedule: adminProcedure.query(async () => {
    const [schedule] = await getDb().select().from(ingestionSchedule).limit(1);
    return schedule ?? null;
  }),

  updateSchedule: adminProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        intervalMinutes: z.number().min(60).optional(),
        autoGenerateNews: z.boolean().optional(),
        autoGenerateReports: z.boolean().optional(),
        weeklyDigestEnabled: z.boolean().optional(),
        digestDayOfWeek: z.number().min(0).max(6).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: Record<string, unknown> = {};
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.weeklyDigestEnabled !== undefined) updates.weeklyDigestEnabled = input.weeklyDigestEnabled;
      if (input.digestDayOfWeek !== undefined) updates.digestDayOfWeek = input.digestDayOfWeek;
      if (input.intervalMinutes !== undefined) updates.intervalMinutes = input.intervalMinutes;
      if (input.autoGenerateNews !== undefined) updates.autoGenerateNews = input.autoGenerateNews;
      if (input.autoGenerateReports !== undefined) updates.autoGenerateReports = input.autoGenerateReports;
      if (input.enabled) {
        updates.nextRunAt = new Date(Date.now() + (input.intervalMinutes ?? 360) * 60 * 1000);
      }
      await getDb().update(ingestionSchedule).set(updates).where(eq(ingestionSchedule.id, 1));
      return { success: true };
    }),

  stats: adminProcedure.query(async () => {
    const db = getDb();
    const [[sourceStats], [runStats], [schedule], [{ docCount }], healthCounts] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)`,
        enabled: sql<number>`SUM(CASE WHEN ${ingestionSources.enabled} = 1 THEN 1 ELSE 0 END)`,
        totalDocs: sql<number>`SUM(${ingestionSources.documentCount})`,
      }).from(ingestionSources),
      db.select({
        total: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`SUM(${ingestionRuns.tokensUsed})`,
        lastRun: sql<string>`MAX(${ingestionRuns.startedAt})`,
      }).from(ingestionRuns),
      db.select().from(ingestionSchedule).limit(1),
      db.select({ docCount: sql<number>`COUNT(*)` }).from(documents),
      db.select({
        status: ingestionSources.healthStatus,
        count: sql<number>`COUNT(*)`,
      }).from(ingestionSources).groupBy(ingestionSources.healthStatus),
    ]);

    const healthSummary = { healthy: 0, degraded: 0, failing: 0, offline: 0 };
    for (const h of healthCounts) {
      if (h.status in healthSummary) healthSummary[h.status as keyof typeof healthSummary] = Number(h.count);
    }

    return {
      totalSources: Number(sourceStats?.total) || 0,
      enabledSources: Number(sourceStats?.enabled) || 0,
      totalRuns: Number(runStats?.total) || 0,
      totalDocumentsIngested: Number(sourceStats?.totalDocs) || 0,
      totalDocumentsInSqlite: Number(docCount) || 0,
      totalTokensUsed: Number(runStats?.totalTokens) || 0,
      // MAX() over a Drizzle timestamp column returns the raw seconds value;
      // convert to ms so JS Date() in the client works.
      lastRunAt: runStats?.lastRun ? Number(runStats.lastRun) * 1000 : null,
      schedule: schedule ?? null,
      healthSummary,
    };
  }),

  seedSources: adminProcedure.mutation(async () => {
    const db = getDb();
    const existing = await db.select().from(ingestionSources);
    const existingUrls = new Set(existing.map((s) => s.url));

    const configSources = await loadDataSources();
    const newSources = configSources
      .filter((s) => !existingUrls.has(s.url))
      .map(({ enabled, ...s }) => ({ ...s, type: s.type as "rss" | "webpage" }));

    for (const source of newSources) {
      await db.insert(ingestionSources).values(source);
    }

    return {
      message: newSources.length > 0
        ? `Added ${newSources.length} new source(s); ${existing.length} already existed`
        : "All sources already configured",
      count: existing.length + newSources.length,
      added: newSources.length,
    };
  }),

  sendDigest: adminProcedure.mutation(async () => {
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { newsArticles } = await import("../../drizzle/schema.js");

    const [recentArticles, recentRuns, sources, [schedule]] = await Promise.all([
      db.select().from(newsArticles).where(gte(newsArticles.createdAt, weekAgo)).orderBy(desc(newsArticles.importance)),
      db.select().from(ingestionRuns).where(gte(ingestionRuns.startedAt, weekAgo)),
      db.select().from(ingestionSources),
      db.select().from(ingestionSchedule).limit(1),
    ]);

    const totalDocs = recentRuns.reduce((s, r) => s + (r.documentsAnalyzed || 0), 0);
    const totalTokens = recentRuns.reduce((s, r) => s + (r.tokensUsed || 0), 0);

    const healthIssues = sources.filter((s) => s.healthStatus !== "healthy");

    const byCityMap: Record<string, typeof recentArticles> = {};
    for (const a of recentArticles) {
      if (!byCityMap[a.city]) byCityMap[a.city] = [];
      byCityMap[a.city].push(a);
    }

    const lines: string[] = [
      `# Cacti Weekly Intelligence Digest`,
      `**${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**`,
      ``,
      `## Pipeline Summary`,
      `- **${recentRuns.length}** ingestion runs this week`,
      `- **${totalDocs}** new documents analyzed`,
      `- **${totalTokens.toLocaleString()}** LLM tokens used`,
      `- **${recentArticles.length}** news articles generated`,
      ``,
    ];

    if (healthIssues.length > 0) {
      lines.push(`## ⚠️ Source Health Issues`);
      for (const s of healthIssues) {
        lines.push(`- **${s.name}**: ${s.healthStatus.toUpperCase()} (${s.consecutiveFailures} failures)`);
      }
      lines.push(``);
    }

    const cities = Object.keys(byCityMap).sort();
    if (cities.length > 0) {
      lines.push(`## Top Stories This Week`);
      for (const city of cities) {
        const cityArticles = byCityMap[city].slice(0, 3);
        lines.push(``, `### ${city}`);
        for (const a of cityArticles) {
          lines.push(`- **${a.headline}** — ${a.summary.slice(0, 120)}...`);
        }
      }
      lines.push(``);
    }

    lines.push(`---`, `*Generated by Cacti Autonomous Intelligence System*`);
    const digestContent = lines.join("\n");

    const { notifyOwner } = await import("../_core/notification.js");
    const sent = await notifyOwner({
      title: `📰 Cacti Weekly Digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      content: digestContent,
    });

    if (sent && schedule) {
      await db.update(ingestionSchedule).set({ lastDigestSentAt: new Date() }).where(eq(ingestionSchedule.id, schedule.id));
    }

    return { sent, articleCount: recentArticles.length, cities: cities.length, healthIssues: healthIssues.length, preview: digestContent.slice(0, 500) };
  }),
});
