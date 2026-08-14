import {
  sqliteTable,
  text,
  integer,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Documents (replaces MongoDB monitoring_data collection)
// ---------------------------------------------------------------------------
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(),
  /** The source's region (the city the source is filed under). */
  city: text("city").notNull(),
  /**
   * The Mohave County city the article is PRIMARILY ABOUT, extracted by the
   * LLM from the article content. Falls back to `city` (source region) when
   * the LLM can't identify a specific Mohave city, or null on older docs
   * that pre-date the field. Used by the Newspaper grouping so that, e.g., a
   * Bee News article about Kingman appears in the Kingman edition.
   */
  aboutCity: text("aboutCity"),
  category: text("category").notNull(),
  publishedAt: integer("publishedAt", { mode: "timestamp" }),
  scrapedAt: integer("scrapedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  /** Full AI analysis JSON object */
  analysis: text("analysis", { mode: "json" }),
  /** Quick-access sentiment: positive | negative | neutral */
  sentiment: text("sentiment"),
  /** Impact level 1-10 */
  impactLevel: integer("impactLevel"),
  /** JSON array of topic strings */
  topics: text("topics", { mode: "json" }).$type<string[]>(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ---------------------------------------------------------------------------
// Document entities (entity graph, replaces in-memory MongoDB aggregation)
// ---------------------------------------------------------------------------
export const documentEntities = sqliteTable("document_entities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("documentId")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  city: text("city"),
});

export type DocumentEntity = typeof documentEntities.$inferSelect;
export type InsertDocumentEntity = typeof documentEntities.$inferInsert;

// ---------------------------------------------------------------------------
// Alert rules
// ---------------------------------------------------------------------------
export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // keyword | sentiment_threshold | impact_level | anomaly
  /** JSON config: { keywords, threshold, cities, sources } */
  config: text("config", { mode: "json" }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  severity: text("severity").default("warning").notNull(), // critical | warning | info
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

// ---------------------------------------------------------------------------
// Alert instances
// ---------------------------------------------------------------------------
export const alertInstances = sqliteTable("alert_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("ruleId").references(() => alertRules.id),
  documentId: integer("documentId").references(() => documents.id),
  title: text("title").notNull(),
  summary: text("summary"),
  severity: text("severity").default("warning").notNull(),
  status: text("status").default("active").notNull(), // active | acknowledged | resolved
  type: text("type").notNull(),
  city: text("city"),
  source: text("source"),
  acknowledgedAt: integer("acknowledgedAt", { mode: "timestamp" }),
  resolvedAt: integer("resolvedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AlertInstance = typeof alertInstances.$inferSelect;
export type InsertAlertInstance = typeof alertInstances.$inferInsert;

// ---------------------------------------------------------------------------
// Intelligence query history
// ---------------------------------------------------------------------------
export const queryHistory = sqliteTable("query_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  tokensUsed: integer("tokensUsed").default(0),
  sourcesConsulted: integer("sourcesConsulted").default(0),
  model: text("model"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type QueryHistoryEntry = typeof queryHistory.$inferSelect;
export type InsertQueryHistory = typeof queryHistory.$inferInsert;

// ---------------------------------------------------------------------------
// Generated intelligence reports
// ---------------------------------------------------------------------------
export const generatedReports = sqliteTable("generated_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").default("daily").notNull(), // daily | weekly | custom
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata", { mode: "json" }),
  tokensUsed: integer("tokensUsed").default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = typeof generatedReports.$inferInsert;

// ---------------------------------------------------------------------------
// AI-generated news articles
// ---------------------------------------------------------------------------
export const newsArticles = sqliteTable("news_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  body: text("body").notNull(),
  whyItMatters: text("whyItMatters"),
  city: text("city").notNull(),
  category: text("category").notNull(),
  importance: integer("importance").default(5).notNull(),
  citations: text("citations", { mode: "json" }).notNull().$type<
    Array<{ documentId: number; title: string; source: string; date: string }>
  >(),
  metadata: text("metadata", { mode: "json" }),
  isBreaking: integer("isBreaking", { mode: "boolean" }).default(false).notNull(),
  edition: text("edition").notNull(),
  tokensUsed: integer("tokensUsed").default(0),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = typeof newsArticles.$inferInsert;

// ---------------------------------------------------------------------------
// Ingestion sources
// ---------------------------------------------------------------------------
export const ingestionSources = sqliteTable("ingestion_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(), // rss | webpage | api | sitemap
  city: text("city").notNull(),
  category: text("category").notNull(),
  sourceLabel: text("sourceLabel").notNull(),
  config: text("config", { mode: "json" }),
  enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
  intervalMinutes: integer("intervalMinutes").default(360).notNull(),
  lastScrapedAt: integer("lastScrapedAt", { mode: "timestamp" }),
  documentCount: integer("documentCount").default(0).notNull(),
  lastError: text("lastError"),
  consecutiveFailures: integer("consecutiveFailures").default(0).notNull(),
  healthStatus: text("healthStatus").default("healthy").notNull(),
  lastAlertSentAt: integer("lastAlertSentAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type IngestionSource = typeof ingestionSources.$inferSelect;
export type InsertIngestionSource = typeof ingestionSources.$inferInsert;

// ---------------------------------------------------------------------------
// Ingestion runs
// ---------------------------------------------------------------------------
export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("sourceId").references(() => ingestionSources.id),
  status: text("status").default("running").notNull(), // running | completed | failed | partial
  trigger: text("trigger").default("manual").notNull(), // manual | scheduled | system
  documentsFound: integer("documentsFound").default(0).notNull(),
  documentsAnalyzed: integer("documentsAnalyzed").default(0).notNull(),
  articlesGenerated: integer("articlesGenerated").default(0).notNull(),
  tokensUsed: integer("tokensUsed").default(0).notNull(),
  errorMessage: text("errorMessage"),
  log: text("log", { mode: "json" }),
  startedAt: integer("startedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type InsertIngestionRun = typeof ingestionRuns.$inferInsert;

// ---------------------------------------------------------------------------
// Ingestion schedule
// ---------------------------------------------------------------------------
export const ingestionSchedule = sqliteTable("ingestion_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enabled: integer("enabled", { mode: "boolean" }).default(false).notNull(),
  intervalMinutes: integer("intervalMinutes").default(360).notNull(),
  autoGenerateNews: integer("autoGenerateNews", { mode: "boolean" }).default(true).notNull(),
  autoGenerateReports: integer("autoGenerateReports", { mode: "boolean" }).default(false).notNull(),
  lastRunAt: integer("lastRunAt", { mode: "timestamp" }),
  nextRunAt: integer("nextRunAt", { mode: "timestamp" }),
  weeklyDigestEnabled: integer("weeklyDigestEnabled", { mode: "boolean" }).default(false).notNull(),
  digestDayOfWeek: integer("digestDayOfWeek").default(1).notNull(),
  lastDigestSentAt: integer("lastDigestSentAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type IngestionScheduleConfig = typeof ingestionSchedule.$inferSelect;
export type InsertIngestionSchedule = typeof ingestionSchedule.$inferInsert;

// ---------------------------------------------------------------------------
// Users (Google OAuth)
// ---------------------------------------------------------------------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  googleId: text("googleId").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatarUrl"),
  /** Access tier: public | invited | owner */
  tier: text("tier").default("invited").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSeenAt: integer("lastSeenAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserTier = "public" | "invited" | "owner";
