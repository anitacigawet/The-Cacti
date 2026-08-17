import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/routers";

const today = "2026-08-17";
const iso = (daysAgo = 0) => new Date(Date.UTC(2026, 7, 17 - daysAgo, 16, 0, 0)).toISOString();
const cities = ["Kingman", "Lake Havasu City", "Bullhead City", "Mohave County", "Colorado City"];

type DemoDocument = {
  id: number;
  title: string;
  source: string;
  sourceUrl: string;
  category: string;
  city: string;
  content: string;
  publishedDate: string;
  hasAnalysis: boolean;
  sentiment: string;
  sentimentScore: number;
  impactLevel: string;
  summary: string;
  topics: string[];
  categories: string[];
};

const seedDocuments: DemoDocument[] = [
  {
    id: 101,
    title: "Showroom sample: library board reviews evening-hour pilot",
    source: "Fictional public meeting record",
    sourceUrl: "#showroom-source",
    category: "Public Meeting",
    city: "Kingman",
    content: "This fictional record describes a proposed twelve-week pilot that would keep two library branches open later on Tuesdays and Thursdays. The sample board packet compares staffing coverage, transit access, and attendance measures. It exists only to demonstrate how The Cacti preserves a source document and connects it to analysis, entities, alerts, and newspaper coverage.",
    publishedDate: iso(1),
    hasAnalysis: true,
    sentiment: "positive",
    sentimentScore: 0.72,
    impactLevel: "Medium",
    summary: "A fictional library board packet proposes a measured evening-hours pilot with public reporting at the end of twelve weeks.",
    topics: ["Library access", "Pilot program", "Public services"],
    categories: ["Community Services", "Public Meeting"],
  },
  {
    id: 102,
    title: "Showroom sample: council packet outlines shade-stop prototype",
    source: "Fictional council agenda",
    sourceUrl: "#showroom-source",
    category: "City Council",
    city: "Lake Havasu City",
    content: "This fictional agenda item considers three temporary shade structures at busy transit stops. The placeholder proposal includes temperature sensors, rider surveys, and a removal clause so the prototype can be evaluated before any permanent construction.",
    publishedDate: iso(2),
    hasAnalysis: true,
    sentiment: "neutral",
    sentimentScore: 0.55,
    impactLevel: "High",
    summary: "A fictional city proposal would test removable shade structures and publish rider-comfort measurements before deciding on permanent installations.",
    topics: ["Transit", "Heat resilience", "Public space"],
    categories: ["Infrastructure", "City Council"],
  },
  {
    id: 103,
    title: "Showroom sample: parks notice schedules river-path repair",
    source: "Fictional department notice",
    sourceUrl: "#showroom-source",
    category: "Public Notice",
    city: "Bullhead City",
    content: "This fictional notice schedules a short closure of a river-path segment for surface repair. The example includes an accessible detour, work windows, and a contact channel for mobility questions.",
    publishedDate: iso(3),
    hasAnalysis: true,
    sentiment: "neutral",
    sentimentScore: 0.5,
    impactLevel: "Low",
    summary: "A fictional repair notice pairs a temporary path closure with an accessible signed detour and a defined completion window.",
    topics: ["Parks", "Accessibility", "Maintenance"],
    categories: ["Public Notice", "Infrastructure"],
  },
  {
    id: 104,
    title: "Showroom sample: county workshop compares cooling-center hours",
    source: "Fictional workshop minutes",
    sourceUrl: "#showroom-source",
    category: "County Government",
    city: "Mohave County",
    content: "This fictional workshop compares three scheduling models for cooling centers. The sample record tracks operating hours, transportation coordination, staffing assumptions, and a proposed public dashboard.",
    publishedDate: iso(4),
    hasAnalysis: true,
    sentiment: "mixed",
    sentimentScore: 0.44,
    impactLevel: "High",
    summary: "A fictional county workshop compares cooling-center schedules and identifies transportation coordination as the main unresolved dependency.",
    topics: ["Cooling centers", "Emergency planning", "Transportation"],
    categories: ["Public Safety", "County Government"],
  },
  {
    id: 105,
    title: "Showroom sample: planning memo maps a safe crossing study",
    source: "Fictional planning memorandum",
    sourceUrl: "#showroom-source",
    category: "Planning",
    city: "Colorado City",
    content: "This fictional planning memo defines a pedestrian-count study near a school and community center. It lists observation windows, accessibility criteria, and the evidence required before a crossing treatment is selected.",
    publishedDate: iso(5),
    hasAnalysis: true,
    sentiment: "positive",
    sentimentScore: 0.68,
    impactLevel: "Medium",
    summary: "A fictional planning memo establishes the measurements needed before choosing a pedestrian crossing treatment.",
    topics: ["Pedestrian safety", "Planning", "Schools"],
    categories: ["Planning", "Transportation"],
  },
  {
    id: 106,
    title: "Showroom sample: budget appendix separates one-time and recurring costs",
    source: "Fictional budget appendix",
    sourceUrl: "#showroom-source",
    category: "Budget",
    city: "Kingman",
    content: "This fictional budget appendix demonstrates how The Cacti stores a dense fiscal record. It separates equipment purchases from recurring staffing, identifies assumptions, and preserves the page references used in downstream coverage.",
    publishedDate: iso(6),
    hasAnalysis: true,
    sentiment: "neutral",
    sentimentScore: 0.51,
    impactLevel: "Medium",
    summary: "A fictional appendix clarifies which pilot costs recur and which are one-time purchases.",
    topics: ["Budget", "Public services", "Procurement"],
    categories: ["Budget", "City Council"],
  },
];

const citationsFor = (doc: DemoDocument) => [{ documentId: doc.id, title: doc.title, source: doc.source, date: doc.publishedDate }];
const newsArticles = seedDocuments.map((doc, index) => ({
  id: 501 + index,
  headline: doc.title.replace("Showroom sample: ", ""),
  summary: doc.summary,
  body: `${doc.summary}\n\n${doc.content}\n\nAll names, records, measurements, and events in this showroom edition are fictional. The screen and its citation workflow are the real product interface.`,
  whyItMatters: "This fictional example shows how a public record becomes a readable local article while preserving a direct route back to its source.",
  city: doc.city,
  category: doc.category,
  importance: 9 - index,
  citations: citationsFor(doc),
  metadata: { showroom: true },
  isBreaking: index === 1,
  edition: today,
  tokensUsed: 0,
  createdAt: iso(index),
}));

let queryHistory: any[] = [
  {
    id: 1,
    question: "Which showroom records depend on transportation coordination?",
    answer: "Two fictional records do: the cooling-center workshop and the shade-stop prototype. The first treats transportation as an unresolved dependency; the second measures rider comfort at transit stops.",
    tokensUsed: 0,
    sourcesConsulted: 2,
    model: "deterministic showroom",
    createdAt: iso(0),
  },
];

let rules: any[] = [
  { id: 1, name: "High-impact demonstration records", description: "Flags fictional records marked high impact.", type: "impact_level", config: { impactLevel: "High" }, enabled: true, severity: "warning", createdAt: iso(7), updatedAt: iso(0) },
  { id: 2, name: "Transportation references", description: "Finds the transportation theme across the sample packet.", type: "keyword", config: { keywords: ["transportation", "transit"] }, enabled: true, severity: "info", createdAt: iso(7), updatedAt: iso(0) },
];

let alertInstances: any[] = [
  { id: 1, ruleId: 1, documentId: 104, title: "[High-impact demonstration records] county workshop compares cooling-center hours", summary: seedDocuments[3].summary, severity: "warning", status: "active", type: "impact_level", city: "Mohave County", source: seedDocuments[3].source, createdAt: iso(1) },
  { id: 2, ruleId: 2, documentId: 102, title: "[Transportation references] council packet outlines shade-stop prototype", summary: seedDocuments[1].summary, severity: "info", status: "acknowledged", type: "keyword", city: "Lake Havasu City", source: seedDocuments[1].source, createdAt: iso(2), acknowledgedAt: iso(1) },
];

const sources = seedDocuments.slice(0, 5).map((doc, index) => ({
  id: index + 1,
  name: `${doc.city} showroom source`,
  url: "https://example.invalid/showroom",
  type: index % 2 ? "webpage" : "rss",
  city: doc.city,
  category: doc.category,
  sourceLabel: doc.source,
  config: { showroom: true },
  enabled: true,
  intervalMinutes: index === 0 ? 60 : 360,
  lastScrapedAt: iso(index + 1),
  documentCount: index === 0 ? 2 : 1,
  lastError: null,
  consecutiveFailures: 0,
  healthStatus: "healthy",
  lastAlertSentAt: null,
  createdAt: iso(20),
  updatedAt: iso(1),
}));

let runs: any[] = [
  { id: 1, sourceId: null, status: "completed", trigger: "scheduled", documentsFound: 6, documentsAnalyzed: 6, articlesGenerated: 6, tokensUsed: 0, errorMessage: null, log: ["SHOWROOM: loaded six fictional records", "STORED: deterministic sample packet", "SHOWROOM: external collection and model calls remained disconnected"], startedAt: iso(1), completedAt: iso(1), createdAt: iso(1) },
];

const reportContent = `# Daily civic brief — fictional showroom edition

## What changed

Six fictional public records move through the same document, analysis, alert, and newspaper workflow used by the full application. The highest-impact samples concern heat resilience and cooling-center coordination.

## Connections worth reviewing

- Transportation appears in both the cooling-center workshop and the transit-shade prototype.
- Two records describe bounded pilots with explicit measurement plans.
- Every statement in this brief links back to the deterministic sample packet; no live collection or model provider ran.

## Reading note

This is placeholder content inside the real report interface, not a claim about Mohave County or any person.`;

let reports: any[] = [
  { id: 1, type: "daily", title: "Daily civic brief — fictional showroom edition", content: reportContent, metadata: { documentCount: 6, generatedAt: iso(0), showroom: true }, tokensUsed: 0, createdAt: iso(0) },
];

const settings = {
  activeProvider: "gemini",
  gemini: { hasKey: false, apiKey: null, model: "External provider disconnected" },
  openai: { hasKey: false, apiKey: null, model: "External provider disconnected" },
  deepseek: { hasKey: false, apiKey: null, model: "External provider disconnected" },
  rateLimitEnabled: true,
  rateLimitPerSecond: 0,
};

function filterDocuments(input: any = {}) {
  let items = [...seedDocuments];
  if (input.city) items = items.filter((item) => item.city === input.city);
  if (input.source) items = items.filter((item) => item.source === input.source);
  if (input.category) items = items.filter((item) => item.category === input.category);
  if (input.sentiment) items = items.filter((item) => item.sentiment === input.sentiment);
  if (input.search) {
    const search = String(input.search).toLowerCase();
    items = items.filter((item) => `${item.title} ${item.content}`.toLowerCase().includes(search));
  }
  const total = items.length;
  const limit = input.limit ?? 20;
  const page = input.page ?? 1;
  return { items: items.slice((page - 1) * limit, page * limit), total, page, totalPages: Math.ceil(total / limit) || 1 };
}

function detailFor(id: number) {
  const doc = seedDocuments.find((item) => item.id === id);
  if (!doc) return null;
  return {
    ...doc,
    cleanedContent: doc.content,
    analysis: {
      summary: doc.summary,
      topics: doc.topics,
      sentiment: { Overall: doc.sentiment, Score: doc.sentimentScore },
      impactLevel: doc.impactLevel,
      categories: doc.categories,
      actionItems: ["Review the fictional source record", "Compare the stated measurement plan with the proposed decision"],
    },
    entities: {
      organization: ["Showroom Library Board", "Showroom Transit Office"],
      location: [doc.city],
      date: ["Twelve-week fictional pilot"],
    },
    analyzedAt: iso(0),
  };
}

async function handle(path: string, input: any): Promise<any> {
  switch (path) {
    case "auth.me": return { authenticated: true, user: { id: 1, googleId: "showroom", email: "showroom@local.invalid", name: "Showroom visitor", avatarUrl: null, tier: "owner", lastSeenAt: iso(0), createdAt: iso(30) }, tier: "owner" };
    case "auth.logout": return { success: true };
    case "documents.list": return filterDocuments(input);
    case "documents.detail": return detailFor(input.id);
    case "documents.filterOptions": return { cities, sources: ["Fictional public meeting record", "Fictional council agenda", "Fictional department notice", "Fictional workshop minutes", "Fictional planning memorandum", "Fictional budget appendix"], categories: ["Budget", "City Council", "County Government", "Planning", "Public Meeting", "Public Notice"] };
    case "analytics.metrics": return { totalDocuments: 6, analyzedDocuments: 6, analysisCoverage: 100, totalSources: 6, totalCities: 5 };
    case "analytics.sentimentDistribution": return { positive: 2, neutral: 3, negative: 0, mixed: 1 };
    case "analytics.impactDistribution": return { High: 2, Medium: 3, Low: 1 };
    case "analytics.sourceBreakdown": return seedDocuments.map((doc) => ({ source: doc.source, count: 1 }));
    case "analytics.cityBreakdown": return cities.map((city) => ({ city, count: seedDocuments.filter((doc) => doc.city === city).length }));
    case "analytics.categoryBreakdown": return [{ category: "Public Meeting", count: 1 }, { category: "Infrastructure", count: 2 }, { category: "Planning", count: 1 }, { category: "Budget", count: 1 }];
    case "analytics.timeline": return seedDocuments.map((doc) => ({ date: doc.publishedDate.slice(0, 10), total: 1, [doc.city]: 1 }));
    case "analytics.topTopics": return [{ topic: "Public services", count: 2 }, { topic: "Transportation", count: 2 }, { topic: "Pilot programs", count: 2 }, { topic: "Accessibility", count: 1 }, { topic: "Heat resilience", count: 1 }].slice(0, input?.limit ?? 15);
    case "analytics.recentIntelligence": return seedDocuments.slice(0, input?.limit ?? 10).map((doc) => ({ id: doc.id, title: doc.title, city: doc.city, source: doc.source, publishedDate: doc.publishedDate, summary: doc.summary, sentiment: doc.sentiment, sentimentScore: doc.sentimentScore, impactLevel: doc.impactLevel, topics: doc.topics.slice(0, 3) }));
    case "entities.graph": return {
      nodes: [
        { id: "organization::Showroom Library Board", name: "Showroom Library Board", type: "organization", count: 4 },
        { id: "organization::Showroom Transit Office", name: "Showroom Transit Office", type: "organization", count: 3 },
        { id: "location::Kingman", name: "Kingman", type: "location", count: 3 },
        { id: "location::Lake Havasu City", name: "Lake Havasu City", type: "location", count: 2 },
        { id: "person::Sample Project Coordinator", name: "Sample Project Coordinator", type: "person", count: 2 },
        { id: "money::$48,000 placeholder budget", name: "$48,000 placeholder budget", type: "money", count: 2 },
        { id: "date::Twelve-week pilot", name: "Twelve-week pilot", type: "date", count: 3 },
      ],
      edges: [
        { source: "organization::Showroom Library Board", target: "location::Kingman", weight: 4 },
        { source: "organization::Showroom Transit Office", target: "location::Lake Havasu City", weight: 3 },
        { source: "organization::Showroom Library Board", target: "date::Twelve-week pilot", weight: 3 },
        { source: "person::Sample Project Coordinator", target: "organization::Showroom Transit Office", weight: 2 },
        { source: "money::$48,000 placeholder budget", target: "organization::Showroom Library Board", weight: 2 },
      ],
    };
    case "intelligence.query": return { answer: "Across the fictional showroom packet, the clearest shared dependency is transportation coordination. The cooling-center workshop identifies it directly, while the shade-stop prototype and pedestrian study treat access as something to measure before a permanent decision. No live model was called for this response.", tokensUsed: 0, sourcesConsulted: 3, model: "deterministic showroom" };
    case "intelligence.dailyBrief": return { date: today, totalDocuments: seedDocuments.length, items: seedDocuments.map((doc) => ({ id: doc.id, title: doc.title, city: doc.city, summary: doc.summary, sentiment: doc.sentiment, impactLevel: doc.impactLevel })), generated: true, message: "Six fictional intelligence items in the showroom packet" };
    case "intelligence.alerts": return alertInstances.map((alert) => ({ id: alert.documentId, title: alert.title, city: alert.city, type: alert.type, severity: alert.severity, summary: alert.summary, publishedDate: alert.createdAt, source: alert.source })).slice(0, input?.limit ?? 20);
    case "queryHistory.list": return queryHistory.slice(0, input?.limit ?? 30);
    case "queryHistory.save": queryHistory = [{ id: Date.now(), ...input, createdAt: iso(0) }, ...queryHistory]; return { success: true };
    case "queryHistory.delete": queryHistory = queryHistory.filter((item) => item.id !== input.id); return { success: true };
    case "queryHistory.clearAll": queryHistory = []; return { success: true };
    case "news.list": {
      let items = [...newsArticles];
      if (input?.city) items = items.filter((item) => item.city === input.city);
      if (input?.category) items = items.filter((item) => item.category === input.category);
      if (input?.edition) items = items.filter((item) => item.edition === input.edition);
      return items.slice(0, input?.limit ?? 30);
    }
    case "news.detail": return newsArticles.find((article) => article.id === input.id) ?? null;
    case "news.editions": return [{ edition: today, cities, articleCount: newsArticles.length }];
    case "news.generate": return { success: true, edition: today, articleCount: input?.city ? 1 : newsArticles.length, cities: input?.city ? [input.city] : cities, totalTokens: 0 };
    case "news.generateAll": return { success: true, edition: today, articleCount: newsArticles.length, cities, cityCounts: Object.fromEntries(cities.map((city) => [city, newsArticles.filter((article) => article.city === city).length])), totalTokens: 0 };
    case "news.delete":
    case "news.deleteEdition":
    case "news.clearCity": return { success: true };
    case "reports.list": return reports.slice(0, input?.limit ?? 20);
    case "reports.detail": return reports.find((report) => report.id === input.id) ?? null;
    case "reports.generateDaily": {
      const result = { success: true, title: "Daily civic brief — fictional showroom edition", content: reportContent, tokensUsed: 0, documentCount: 6 };
      reports = [{ id: Date.now(), type: "daily", ...result, metadata: { documentCount: 6, showroom: true }, createdAt: iso(0) }, ...reports];
      return result;
    }
    case "reports.generateWeekly": return { success: true, title: "Weekly civic report — fictional showroom edition", content: reportContent, tokensUsed: 0, documentCount: 6 };
    case "reports.delete": reports = reports.filter((report) => report.id !== input.id); return { success: true };
    case "alertRules.list": return rules;
    case "alertRules.instances": return input?.status && input.status !== "all" ? alertInstances.filter((item) => item.status === input.status) : alertInstances;
    case "alertRules.stats": return { active: alertInstances.filter((item) => item.status === "active").length, acknowledged: alertInstances.filter((item) => item.status === "acknowledged").length, resolved: alertInstances.filter((item) => item.status === "resolved").length, total: alertInstances.length, rules: rules.length };
    case "alertRules.create": rules = [...rules, { id: Date.now(), ...input, enabled: true, createdAt: iso(0), updatedAt: iso(0) }]; return { success: true };
    case "alertRules.update": rules = rules.map((rule) => rule.id === input.id ? { ...rule, ...input, updatedAt: iso(0) } : rule); return { success: true };
    case "alertRules.delete": rules = rules.filter((rule) => rule.id !== input.id); alertInstances = alertInstances.filter((item) => item.ruleId !== input.id); return { success: true };
    case "alertRules.acknowledge": alertInstances = alertInstances.map((item) => item.id === input.id ? { ...item, status: "acknowledged", acknowledgedAt: iso(0) } : item); return { success: true };
    case "alertRules.resolve": alertInstances = alertInstances.map((item) => item.id === input.id ? { ...item, status: "resolved", resolvedAt: iso(0) } : item); return { success: true };
    case "alertRules.evaluate": return { evaluated: 6, newAlerts: 0, rulesChecked: rules.length, criticalNotified: 0 };
    case "ingestion.listSources": return sources;
    case "ingestion.listRuns": return runs.slice(0, input?.limit ?? 20);
    case "ingestion.getSchedule": return { id: 1, enabled: false, intervalMinutes: 360, autoGenerateNews: true, autoGenerateReports: false, lastRunAt: iso(1), nextRunAt: null, weeklyDigestEnabled: false, digestDayOfWeek: 1, lastDigestSentAt: null, updatedAt: iso(0) };
    case "ingestion.stats": return { totalSources: sources.length, enabledSources: sources.length, totalRuns: runs.length, totalDocumentsIngested: 6, totalDocumentsInSqlite: 6, totalTokensUsed: 0, lastRunAt: new Date(iso(1)).getTime(), schedule: { enabled: false }, healthSummary: { healthy: sources.length, degraded: 0, failing: 0, offline: 0 } };
    case "ingestion.runSource": return { runId: Date.now(), documentsFound: 1, documentsAnalyzed: 1, tokensUsed: 0, log: ["SHOWROOM: replayed one fictional source", "SHOWROOM: no network or model call was made"] };
    case "ingestion.runPipeline": {
      const result = { id: Date.now(), sourceId: null, status: "completed", trigger: "manual", documentsFound: 6, documentsAnalyzed: 6, articlesGenerated: 6, tokensUsed: 0, errorMessage: null, log: ["SHOWROOM: replayed deterministic source packet", "SHOWROOM: collection and providers stayed disconnected"], startedAt: iso(0), completedAt: iso(0), createdAt: iso(0) };
      runs = [result, ...runs];
      return { runId: result.id, sourcesProcessed: sources.length, totalDocumentsFound: 6, totalDocumentsAnalyzed: 6, totalTokens: 0, log: result.log };
    }
    case "ingestion.addSource": return { id: Date.now() };
    case "ingestion.updateSource":
    case "ingestion.deleteSource":
    case "ingestion.updateSchedule": return { success: true };
    case "ingestion.seedSources": return { message: "The fictional showroom sources are already loaded", count: sources.length, added: 0 };
    case "ingestion.sendDigest": return { sent: false, articleCount: newsArticles.length, cities: cities.length, healthIssues: 0, preview: "Showroom preview only — email delivery is disconnected." };
    case "settings.get": return settings;
    case "settings.save":
    case "settings.clearKey": return { success: true };
    case "settings.testConnection": return { success: true, message: "Showroom mode keeps external model providers disconnected." };
    case "admin.users.list": return [{ id: 1, googleId: "showroom", email: "showroom@local.invalid", name: "Showroom visitor", avatarUrl: null, tier: "owner", lastSeenAt: iso(0), createdAt: iso(30) }];
    case "admin.users.setTier": return { success: true };
    case "admin.reanalyze": return { scanned: 6, updated: 0, totalTokens: 0 };
    default: throw new Error(`Showroom adapter does not implement ${path}`);
  }
}

export function createDemoLink(): TRPCLink<AppRouter> {
  return () => ({ op }) => observable((observer) => {
    const timer = window.setTimeout(() => {
      void handle(op.path, op.input)
        .then((data) => {
          observer.next({ result: { data } } as any);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    }, op.type === "mutation" ? 360 : 55);
    return () => window.clearTimeout(timer);
  });
}
