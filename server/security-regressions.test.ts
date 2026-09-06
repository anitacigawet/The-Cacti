import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { eq } from "drizzle-orm";
import type { AppRouter } from "./routers.js";

test("HTTP security boundaries with synthetic local data", async (t) => {
  const originalCwd = process.cwd();
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const runtime = mkdtempSync(path.join(tmpdir(), "cacti-security-test-"));
  cpSync(path.join(repository, "drizzle/migrations"), path.join(runtime, "drizzle/migrations"), { recursive: true });
  Object.assign(process.env, {
    DATABASE_PATH: path.join(runtime, "data/app.db"), JWT_SECRET: "synthetic-test-session-secret-no-real-account",
    GOOGLE_OAUTH_CLIENT_ID: "synthetic-client-id", GOOGLE_OAUTH_CLIENT_SECRET: "synthetic-client-secret", OWNER_EMAIL: "",
    GEMINI_API_KEY: "", OPENAI_API_KEY: "", DEEPSEEK_API_KEY: "", RESEND_API_KEY: "",
  });
  process.chdir(runtime);
  t.after(() => {
    process.chdir(originalCwd);
    assert.equal(path.dirname(runtime), path.resolve(tmpdir()));
    assert.ok(path.basename(runtime).startsWith("cacti-security-test-"));
    rmSync(runtime, { recursive: true, force: true });
  });
  const { initDb, getDb } = await import("./db.js");
  const { documents, documentEntities, alertInstances, newsArticles, generatedReports, users } = await import("../drizzle/schema.js");
  const { appRouter } = await import("./routers.js");
  const { createContext } = await import("./_core/context.js");
  const { signSession, freshnessThreshold } = await import("./_core/auth.js");
  const { registerAuthRoutes } = await import("./_core/auth-routes.js");
  const { registerSSERoute, visibleMetrics } = await import("./routers/realtime.js");
  await initDb();
  const db = getDb();
  const [owner, invited] = await db.insert(users).values([
    { googleId: "owner", email: "owner@example.invalid", name: "Test owner", tier: "owner" },
    { googleId: "invited", email: "invited@example.invalid", name: "Test invited", tier: "invited" },
  ]).returning();
  const now = Date.now();
  for (const [index, hours] of [25, 4, 1, -1].entries()) {
    const createdAt = new Date(now - hours * 3600_000);
    const [doc] = await db.insert(documents).values({
      title: `Record-${index}`, content: index === 0 ? "High impact phrase" : "ordinary record",
      url: `https://example.invalid/${index}`, city: `City-${index}`, source: `Source-${index}`, category: `Category-${index}`,
      sentiment: "neutral", topics: [`Topic-${index}`], analysis: { Summary: `Summary-${index}`, "Impact Level": index === 0 ? "Low" : " high " },
      impactLevel: 0, createdAt, publishedAt: createdAt,
    }).returning();
    await db.insert(documentEntities).values({ documentId: doc.id, name: `Entity-${index}`, type: "person", city: doc.city });
    await db.insert(alertInstances).values({ documentId: doc.id, title: doc.title, summary: `Summary-${index}`, type: "keyword", createdAt });
    await db.insert(newsArticles).values({ headline: doc.title, summary: doc.title, body: doc.title, city: doc.city, category: "community", citations: [], edition: `Edition-${index}`, createdAt });
    await db.insert(generatedReports).values({ title: doc.title, content: doc.title, type: "daily", createdAt });
  }
  // Old alert pointing at fresh data must remain withheld; old standalone alert remains visible.
  await db.insert(alertInstances).values([
    { documentId: 3, title: "Old copy of fresh record", type: "keyword", createdAt: new Date(now - 25 * 3600_000) },
    { title: "Standalone old alert", type: "keyword", createdAt: new Date(now - 25 * 3600_000) },
  ]);
  const app = express();
  registerAuthRoutes(app);
  registerSSERoute(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const cookie = (uid: number) => `cacti_session=${signSession(uid)}`;
  const client = (uid?: number) => createTRPCProxyClient<AppRouter>({ links: [httpLink({ transformer: superjson, url: `${base}/api/trpc`, headers: uid ? { cookie: cookie(uid) } : {} })] });

  await t.test("OAuth malicious and malformed query values cannot render HTML", async () => {
    for (const query of ["error=" + encodeURIComponent('<svg onload="document.title=1">'), "error=" + encodeURIComponent('<img src=x onerror=alert(1)>'), "error[a]=value", "code[]=x&state[]=y", "code=x&state=wrong"]) {
      const response = await fetch(`${base}/api/auth/google/callback?${query}`);
      assert.equal(response.status, 400);
      assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
    }
  });

  await t.test("normal OAuth state exchange still creates a session with mocked Google responses", async (subtest) => {
    const nativeFetch = globalThis.fetch;
    const calls: string[] = [];
    subtest.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(base)) return nativeFetch(input, init);
      calls.push(url);
      if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access-token" });
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") return Response.json({ sub: "oauth-fixture", email: "oauth@example.invalid", email_verified: true, name: "OAuth fixture" });
      throw new Error("Unexpected external request in OAuth test");
    });
    const start = await fetch(base + "/api/auth/google", { redirect: "manual" });
    assert.equal(start.status, 302);
    const location = new URL(start.headers.get("location")!);
    assert.equal(location.origin, "https://accounts.google.com");
    const state = location.searchParams.get("state")!;
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
    const callback = await fetch(`${base}/api/auth/google/callback?code=synthetic-code&state=${encodeURIComponent(state)}`, { redirect: "manual", headers: { cookie: stateCookie } });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get("location"), "/");
    assert.match(callback.headers.get("set-cookie")!, /cacti_session=/);
    assert.equal(calls.length, 2);
  });

  await t.test("all public copies and aggregates respect public/invited/owner cutoffs", async () => {
    assert.equal(freshnessThreshold("public", now).getTime(), now - 24 * 3600_000);
    assert.equal(freshnessThreshold("invited", now).getTime(), now - 3 * 3600_000);
    for (const [uid, count] of [[undefined, 1], [invited.id, 2], [owner.id, 3]] as const) {
      const api = client(uid);
      assert.equal((await api.documents.list.query({})).total, count);
      assert.equal(await api.documents.detail.query({ id: count + 1 }), null);
      assert.equal((await api.documents.filterOptions.query()).cities.length, count);
      assert.equal((await api.analytics.metrics.query()).totalDocuments, count);
      assert.equal((await api.analytics.recentIntelligence.query({})).length, count);
      assert.equal((await api.analytics.sentimentDistribution.query()).neutral, count);
      assert.equal(Object.values(await api.analytics.impactDistribution.query()).reduce((a, b) => a + b, 0), count);
      for (const result of [await api.analytics.sourceBreakdown.query(), await api.analytics.cityBreakdown.query(), await api.analytics.categoryBreakdown.query()]) assert.equal(result.length, count);
      assert.equal((await api.analytics.topTopics.query({})).length, count);
      assert.equal((await api.analytics.timeline.query()).reduce((total, row) => total + row.total, 0), count);
      assert.equal((await api.entities.graph.query()).nodes.length, count);
      assert.equal((await api.entities.spotlight.query({ entityId: `person::Entity-${count}` }))?.totalMentions, 0);
      assert.equal((await api.entities.topByType.query({})).length, count);
      assert.equal((await api.alertRules.instances.query({})).length, count + 1 + (uid === owner.id ? 1 : 0));
      assert.equal((await api.alertRules.instances.query({ status: "active" })).length, count + 1 + (uid === owner.id ? 1 : 0));
      assert.equal((await api.alertRules.stats.query()).total, count + 1 + (uid === owner.id ? 1 : 0));
      assert.equal((await api.news.list.query({})).length, count);
      assert.equal(await api.news.detail.query({ id: count + 1 }), null);
      assert.equal((await api.news.editions.query()).length, count);
      assert.equal((await api.reports.list.query({})).length, count);
      assert.equal(await api.reports.detail.query({ id: count + 1 }), null);
    }
    await assert.rejects(client().ingestion.getSchedule.query(), /Sign-in required/);
    await assert.rejects(client(invited.id).ingestion.getSchedule.query(), /Owner access required/);
  });

  await t.test("impact filtering uses classification instead of title/content phrase", async () => {
    const high = await client(owner.id).documents.list.query({ impactLevel: "High" });
    assert.deepEqual(high.items.map((item) => item.id).sort(), [2, 3]);
    assert.ok(high.items.every((item) => item.impactLevel === "High"));
    const phrase = await client(owner.id).documents.list.query({ search: "High impact" });
    assert.deepEqual(phrase.items.map((item) => item.id), [1]);
    for (const value of ["\nHigh\n", "\tHigh\t", "\u00a0High\ufeff"]) {
      await db.update(documents).set({ analysis: { "Impact Level": value }, impactLevel: null }).where(eq(documents.id, 2));
      assert.ok((await client(owner.id).documents.list.query({ impactLevel: "High" })).items.some((item) => item.id === 2));
    }
    await db.update(documents).set({ analysis: { "Impact Level": "Unknown" }, impactLevel: null }).where(eq(documents.id, 2));
    assert.equal((await client(owner.id).analytics.impactDistribution.query()).Medium, 0);
    assert.equal((await client(owner.id).documents.list.query({ impactLevel: "Medium" })).total, 0);
  });

  await t.test("SSE rechecks changed roles and invalid cookies without broadcasting content", async () => {
    const req = { headers: { cookie: cookie(owner.id) } } as express.Request;
    assert.equal((await visibleMetrics(req)).totalDocuments, 3);
    await db.update(users).set({ tier: "public" }).where(eq(users.id, owner.id));
    assert.equal((await visibleMetrics(req)).totalDocuments, 1);
    assert.equal((await visibleMetrics({ headers: { cookie: "cacti_session=bad" } } as express.Request)).totalDocuments, 1);
    const controller = new AbortController();
    const response = await fetch(`${base}/api/sse/events`, { signal: controller.signal });
    const reader = response.body!.getReader();
    let text = "";
    const deadline = setTimeout(() => controller.abort(), 35_000);
    try {
      while (!text.includes("event: metric\n")) {
        const result = await reader.read();
        if (result.done) break;
        text += new TextDecoder().decode(result.value);
      }
      assert.match(text, /event: metric\ndata: \{"totalDocuments":1,"analyzedDocuments":1\}/);
      assert.ok(!text.includes("Record-") && !text.includes("Summary-") && !text.includes("event: document"));
    } finally { clearTimeout(deadline); controller.abort(); await reader.cancel().catch(() => {}); }
  });
});
