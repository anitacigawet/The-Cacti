import { getDb } from "./db.js";
import {
  ingestionSchedule,
  ingestionSources,
  ingestionRuns,
  documents,
  documentEntities,
  newsArticles,
} from "../drizzle/schema.js";
import { eq, gte, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm.js";
import { isAboutArizona } from "./routers/ingestion.js";
import { generateForCity } from "./routers/news.js";
import { CITIES as REGION_CITIES } from "../shared/region.js";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function shouldRun(): Promise<{ run: boolean; schedule: typeof ingestionSchedule.$inferSelect | null }> {
  const db = getDb();
  const [schedule] = await db.select().from(ingestionSchedule).limit(1);
  if (!schedule || !schedule.enabled) return { run: false, schedule: schedule ?? null };

  if (schedule.lastRunAt) {
    const elapsed = Date.now() - new Date(schedule.lastRunAt).getTime();
    const intervalMs = schedule.intervalMinutes * 60 * 1000;
    if (elapsed < intervalMs) return { run: false, schedule };
  }

  return { run: true, schedule };
}

async function executePipeline(): Promise<void> {
  if (isRunning) {
    console.log("[Cacti Scheduler] Pipeline already running, skipping...");
    return;
  }

  const { run, schedule } = await shouldRun();
  if (!run) return;

  isRunning = true;
  console.log("[Cacti Scheduler] Starting autonomous pipeline run...");

  const db = getDb();

  const [runRow] = await db.insert(ingestionRuns).values({
    trigger: "scheduled",
    status: "running",
  }).returning({ id: ingestionRuns.id });
  const runId = runRow.id;

  try {
    const sources = await db.select().from(ingestionSources).where(eq(ingestionSources.enabled, true));

    if (sources.length === 0) {
      console.log("[Cacti Scheduler] No enabled sources, skipping...");
      await db.update(ingestionRuns).set({ status: "completed", log: ["No enabled sources"], completedAt: new Date() })
        .where(eq(ingestionRuns.id, runId));
      isRunning = false;
      return;
    }

    let totalDocsFound = 0;
    let totalDocsAnalyzed = 0;
    let totalTokens = 0;
    const logEntries: string[] = [`[${new Date().toISOString()}] Scheduled pipeline started: ${sources.length} sources`];

    for (const source of sources) {
      try {
        logEntries.push(`Processing: ${source.name} (${source.type})`);

        let scrapedItems: Array<{ title: string; content: string; link: string; date: string }> = [];

        if (source.type === "rss") {
          const response = await fetch(source.url, {
            headers: { "User-Agent": "Cacti-CivicIntelligence/1.0", Accept: "application/rss+xml,application/xml,text/xml" },
            signal: AbortSignal.timeout(15000),
          });
          if (response.ok) {
            const xml = await response.text();
            const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
            const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
            const allMatches: RegExpExecArray[] = [];
            let m: RegExpExecArray | null;
            while ((m = itemRegex.exec(xml)) !== null) allMatches.push(m);
            while ((m = entryRegex.exec(xml)) !== null) allMatches.push(m);

            for (const itemMatch of allMatches) {
              const ix = itemMatch[1];
              const titleM = ix.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
              const descM = ix.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || ix.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
              const linkM = ix.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || ix.match(/<link[^>]*href="([^"]+)"/i);
              const dateM = ix.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || ix.match(/<published[^>]*>([\s\S]*?)<\/published>/i);

              const title = titleM ? titleM[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "Untitled";
              const content = descM ? descM[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
              const link = linkM ? linkM[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
              const date = dateM ? dateM[1].trim() : new Date().toISOString();

              if (title !== "Untitled") scrapedItems.push({ title, content: content.substring(0, 5000), link, date });
            }
          }
        } else if (source.type === "webpage") {
          const response = await fetch(source.url, {
            headers: { "User-Agent": "Cacti-CivicIntelligence/1.0", Accept: "text/html" },
            signal: AbortSignal.timeout(15000),
          });
          if (response.ok) {
            const html = await response.text();
            const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
            scrapedItems.push({ title: titleMatch ? titleMatch[1].trim() : "Untitled", content: textContent.substring(0, 10000), link: source.url, date: new Date().toISOString() });
          }
        }

        totalDocsFound += scrapedItems.length;

        for (const item of scrapedItems) {
          try {
            // Dedup check by URL or title
            if (item.link) {
              const byUrl = await db.select({ id: documents.id }).from(documents).where(eq(documents.url, item.link)).limit(1);
              if (byUrl.length > 0) { logEntries.push(`SKIP: ${item.title}`); continue; }
            }

            // Pre-flight: short-circuit non-Arizona docs before spending
            // analysis tokens. ~42% of feed content is national wire that
            // we never surface (see scripts/inspect-oos-sources.ts).
            const preflight = await isAboutArizona(item.title, item.content);
            totalTokens += preflight.tokens;
            if (!preflight.isArizona) {
              logEntries.push(`SKIP (non-Arizona): ${item.title}`);
              continue;
            }

            // LLM Analysis — includes AboutCity so docs ingested via the
            // scheduler get the same Mohave / Arizona Wire / Out of State
            // attribution as docs ingested via the manual endpoint.
            const analysisResult = await invokeLLM({
              messages: [
                { role: "system", content: "You are a civic intelligence analyst. Analyze documents and extract structured data. Return valid JSON only." },
                { role: "user", content: `Analyze this Arizona civic document. Source-region (where the publishing source is based): ${source.city}, Mohave County, Arizona.\n\nTitle: ${item.title}\nSource: ${source.sourceLabel}\nContent: ${item.content.substring(0, 4000)}\n\nReturn JSON with: Summary, Key Topics (array), Sentiment ({Overall, Score}), Impact Level (High/Medium/Low), Categories (array), Action Items (array), Key Dates (array), Stakeholders (array), AboutCity.\n\nAboutCity must be one of: 'Kingman' / 'Bullhead City' / 'Lake Havasu City' / 'Mohave County' (primary Mohave coverage — use ONLY when centrally about that specific city, or 'Mohave County' for county-wide and smaller Mohave places like Fort Mohave, Mohave Valley, Laughlin, Golden Valley); 'Phoenix Metro' (Phoenix + any Maricopa County city); 'Flagstaff Area' (Flagstaff/Sedona/Williams/Page/Coconino); 'Tucson Metro' (Tucson/Marana/Oro Valley/Sahuarita/Pima); 'Other Arizona' (anywhere else in AZ, statewide stories not fitting a metro); 'Out of State' (anywhere outside Arizona). Pick based on where the story takes place, not where the source is based.` },
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

            const tokens = analysisResult.usage?.total_tokens || 0;
            totalTokens += tokens;

            let analysis: Record<string, unknown> = {};
            try {
              const c = analysisResult.choices[0]?.message?.content;
              if (typeof c === "string") analysis = JSON.parse(c);
            } catch { /* use empty */ }

            const sentiment = (analysis?.Sentiment as { Overall?: string } | undefined)?.Overall?.toLowerCase() ?? null;
            const impactRaw = analysis?.["Impact Level"] as string | undefined;
            const impactLevel = impactRaw === "High" ? 1 : impactRaw === "Low" ? 0 : null;
            const topics = (analysis?.["Key Topics"] as string[] | undefined) ?? null;
            const llmAboutCity = analysis?.AboutCity as string | undefined;

            const [docRow] = await db.insert(documents).values({
              url: item.link || `${source.sourceLabel}::${item.title}::${Date.now()}`,
              title: item.title,
              content: item.content,
              source: source.sourceLabel,
              city: source.city,
              aboutCity: llmAboutCity || source.city,
              category: source.category,
              publishedAt: item.date ? new Date(item.date) : null,
              analysis,
              sentiment,
              impactLevel,
              topics,
            }).returning({ id: documents.id });

            // Also try basic entity extraction via stakeholders
            const stakeholders = (analysis?.Stakeholders as string[] | undefined) ?? [];
            for (const name of stakeholders) {
              const n = String(name).trim();
              if (n.length >= 2) {
                await db.insert(documentEntities).values({ documentId: docRow.id, name: n, type: "person", city: source.city });
              }
            }

            totalDocsAnalyzed++;
            logEntries.push(`STORED: ${item.title}`);
          } catch (itemErr: unknown) {
            logEntries.push(`ERROR: ${item.title} - ${(itemErr as Error).message}`);
          }
        }

        await db.update(ingestionSources).set({
          lastScrapedAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
          healthStatus: "healthy",
        }).where(eq(ingestionSources.id, source.id));

      } catch (sourceErr: unknown) {
        logEntries.push(`SOURCE FAILED: ${source.name} - ${(sourceErr as Error).message}`);
        const [curSrc] = await db.select().from(ingestionSources).where(eq(ingestionSources.id, source.id));
        const fails = (curSrc?.consecutiveFailures ?? 0) + 1;
        const health = fails >= 5 ? "offline" : fails >= 3 ? "failing" : fails >= 2 ? "degraded" : "healthy";
        await db.update(ingestionSources).set({
          lastError: (sourceErr as Error).message,
          consecutiveFailures: fails,
          healthStatus: health,
          ...(fails >= 5 ? { enabled: false } : {}),
        }).where(eq(ingestionSources.id, source.id));
        if (fails >= 3) {
          try {
            const { notifyOwner } = await import("./_core/notification.js");
            await notifyOwner({
              title: `⚠️ Cacti Source Health Alert: ${source.name}`,
              content: `Source "${source.name}" failed ${fails} times.\nError: ${(sourceErr as Error).message}\nStatus: ${health.toUpperCase()}`,
            });
            await db.update(ingestionSources).set({ lastAlertSentAt: new Date() }).where(eq(ingestionSources.id, source.id));
          } catch { /* best-effort */ }
        }
      }
    }

    await db.update(ingestionRuns).set({
      status: "completed",
      documentsFound: totalDocsFound,
      documentsAnalyzed: totalDocsAnalyzed,
      tokensUsed: totalTokens,
      log: logEntries,
      completedAt: new Date(),
    }).where(eq(ingestionRuns.id, runId));

    const intervalMs = (schedule?.intervalMinutes ?? 360) * 60 * 1000;
    await db.update(ingestionSchedule).set({
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + intervalMs),
    }).where(eq(ingestionSchedule.id, 1));

    console.log(`[Cacti Scheduler] Complete: ${totalDocsAnalyzed}/${totalDocsFound} docs, ${totalTokens} tokens`);

    // Auto-publish a fresh newspaper edition for each city if the schedule
    // has autoGenerateNews enabled. Without this, the anon landing goes
    // stale even when ingestion is running. Run only when this pipeline run
    // actually analyzed new docs — no point regenerating the same edition.
    if (schedule?.autoGenerateNews && totalDocsAnalyzed > 0) {
      const edition = new Date().toISOString().split("T")[0];
      let genTokens = 0;
      let genArticles = 0;
      for (const city of REGION_CITIES) {
        try {
          const { articles, tokens } = await generateForCity(city, edition);
          genTokens += tokens;
          genArticles += articles.length;
        } catch (genErr: unknown) {
          console.error(`[Cacti Scheduler] News generation failed for ${city}:`, (genErr as Error).message);
        }
      }
      console.log(`[Cacti Scheduler] Auto-generated news: ${genArticles} articles across ${REGION_CITIES.length} cities, ${genTokens} tokens`);
    }

    // Weekly digest check
    try {
      const [sched] = await db.select().from(ingestionSchedule).limit(1);
      if (sched?.weeklyDigestEnabled) {
        const now = new Date();
        const lastDigest = sched.lastDigestSentAt ? new Date(sched.lastDigestSentAt) : null;
        const daysSince = lastDigest ? (now.getTime() - lastDigest.getTime()) / 86400000 : 999;
        if (now.getDay() === (sched.digestDayOfWeek ?? 1) && daysSince >= 6) {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const articles = await db.select().from(newsArticles).where(gte(newsArticles.createdAt, weekAgo)).orderBy(desc(newsArticles.importance)).limit(20);
          const runs = await db.select().from(ingestionRuns).where(gte(ingestionRuns.startedAt, weekAgo));
          const allSources = await db.select().from(ingestionSources);
          const healthIssues = allSources.filter((s) => s.healthStatus !== "healthy");
          const lines = [
            `# Cacti Weekly Digest`,
            `**${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**`,
            ``,
            `## Summary: ${runs.length} runs, ${runs.reduce((s, r) => s + (r.documentsAnalyzed || 0), 0)} docs, ${articles.length} articles`,
          ];
          if (healthIssues.length > 0) {
            lines.push(``, `## Health Issues`);
            for (const s of healthIssues) lines.push(`- ${s.name}: ${s.healthStatus.toUpperCase()} (${s.consecutiveFailures} failures)`);
          }
          if (articles.length > 0) {
            lines.push(``, `## Top Stories`);
            for (const a of articles.slice(0, 10)) lines.push(`- **${a.headline}** (${a.city})`);
          }
          const { notifyOwner } = await import("./_core/notification.js");
          await notifyOwner({ title: `Cacti Weekly Digest - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, content: lines.join("\n") });
          await db.update(ingestionSchedule).set({ lastDigestSentAt: now }).where(eq(ingestionSchedule.id, sched.id));
          console.log("[Cacti Scheduler] Weekly digest sent.");
        }
      }
    } catch (digestErr: unknown) {
      console.error("[Cacti Scheduler] Digest error:", (digestErr as Error).message);
    }

  } catch (err: unknown) {
    console.error("[Cacti Scheduler] Pipeline error:", (err as Error).message);
    await db.update(ingestionRuns).set({
      status: "failed",
      errorMessage: (err as Error).message,
      completedAt: new Date(),
    }).where(eq(ingestionRuns.id, runId));
  } finally {
    isRunning = false;
  }
}

/**
 * Seed a schedule row on first run only. Default is DISABLED — owners turn
 * scanning on explicitly from the Settings page. We never touch an existing
 * row: an owner who flipped the schedule off keeps it off.
 */
async function ensureScheduleDefaults(): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(ingestionSchedule).limit(1);
  if (existing) return;
  await db.insert(ingestionSchedule).values({
    enabled: false,
    intervalMinutes: 360,
    autoGenerateNews: true,
    autoGenerateReports: false,
    nextRunAt: null,
  });
  console.log("[Cacti Scheduler] Seeded default schedule (disabled). Enable from Settings to start scanning.");
}

export function startScheduler(): void {
  console.log("[Cacti Scheduler] Initializing autonomous pipeline scheduler...");
  ensureScheduleDefaults().catch((err) => console.error("[Cacti Scheduler] Schedule init error:", err));
  setTimeout(() => {
    executePipeline().catch((err) => console.error("[Cacti Scheduler] Initial check error:", err));
  }, 10000);
  schedulerInterval = setInterval(() => {
    executePipeline().catch((err) => console.error("[Cacti Scheduler] Interval check error:", err));
  }, 5 * 60 * 1000);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Cacti Scheduler] Stopped.");
  }
}
