import { router } from "./_core/trpc.js";
import { documentsRouter } from "./routers/documents.js";
import { analyticsRouter } from "./routers/analytics.js";
import { entitiesRouter } from "./routers/entities.js";
import { intelligenceRouter } from "./routers/intelligence.js";
import { realtimeRouter } from "./routers/realtime.js";
import { alertRulesRouter } from "./routers/alertRules.js";
import { reportsRouter } from "./routers/reports.js";
import { queryHistoryRouter } from "./routers/queryHistory.js";
import { newsRouter } from "./routers/news.js";
import { ingestionRouter } from "./routers/ingestion.js";
import { settingsRouter } from "./routers/settings.js";
import { authRouter } from "./routers/auth.js";
import { adminRouter } from "./routers/admin.js";

export const appRouter = router({
  auth: authRouter,
  admin: adminRouter,
  documents: documentsRouter,
  analytics: analyticsRouter,
  entities: entitiesRouter,
  intelligence: intelligenceRouter,
  realtime: realtimeRouter,
  alertRules: alertRulesRouter,
  reports: reportsRouter,
  queryHistory: queryHistoryRouter,
  news: newsRouter,
  ingestion: ingestionRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
