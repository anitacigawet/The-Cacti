import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import type { ClientRequest, IncomingMessage } from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "./_core/context.js";

test("ingestion paths use the protected source boundary and truthful persisted outcomes", async (t) => {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const originalCwd = process.cwd();
  const runtime = mkdtempSync(path.join(tmpdir(), "cacti-ingestion-test-"));
  const env = { DATABASE_PATH: path.join(runtime, "data/app.db"), LLM_PROVIDER: "openai", OPENAI_API_KEY: "synthetic-key", OPENAI_MODEL: "fixture-model", RESEND_API_KEY: "synthetic-email", RESEND_FROM_EMAIL: "fixture@example.invalid", OWNER_EMAIL: "owner@example.invalid" };
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  cpSync(path.join(repository, "drizzle/migrations"), path.join(runtime, "drizzle/migrations"), { recursive: true });
  process.chdir(runtime);
  t.after(() => {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    assert.equal(path.dirname(runtime), path.resolve(tmpdir()));
    assert.ok(path.basename(runtime).startsWith("cacti-ingestion-test-"));
    rmSync(runtime, { recursive: true, force: true });
  });
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  const bodies = new Map<string, { body?: string; status?: number; location?: string }>();
  const sourceRequests: string[] = [];
  t.mock.method(https, "request", (url: URL, options: any, callback: any) => {
    assert.equal(url.hostname, "93.184.216.34");
    const reply = bodies.get(url.pathname);
    assert.ok(reply, `Unexpected transport path ${url.pathname}`);
    sourceRequests.push(url.pathname);
    assert.match(options.headers["User-Agent"], /feedfetcher|Mozilla/);
    const request = new EventEmitter() as ClientRequest;
    request.end = (() => {
      queueMicrotask(() => callback(Object.assign(Readable.from([Buffer.from(reply.body ?? "")]), {
        statusCode: reply.status ?? 200,
        headers: reply.location ? { location: reply.location } : {},
      }) as IncomingMessage));
      return request;
    }) as ClientRequest["end"];
    return request;
  });
  let providerCalls = 0;
  let newsCalls = 0;
  let rejectNews = false;
  let emailSuccess = false;
  t.mock.method(globalThis, "fetch", async (url: any, init: any) => {
    if (String(url) === "https://api.resend.com/emails") return new Response("fixture", { status: emailSuccess ? 200 : 500 });
    assert.equal(String(url), "https://api.openai.com/v1/chat/completions");
    providerCalls++;
    const request = JSON.parse(init.body);
    const name = request.response_format?.json_schema?.name;
    let data: unknown;
    if (name === "arizona_filter") data = { IsArizona: true };
    else if (name === "civic_analysis") data = { Summary: "Fixture civic summary", Sentiment: { Overall: "neutral", Score: 0.5 }, "Impact Level": "High", "Key Topics": [], AboutCity: "Kingman" };
    else if (name === "entity_extraction") data = { People: [], Organizations: [], Locations: [], Dates: [], Monetary: [] };
    else if (name === "news_articles") {
      newsCalls++;
      if (rejectNews) return new Response("Synthetic news failure", { status: 500 });
      data = { articles: [{ headline: "Fixture newspaper story", summary: "A synthetic newspaper summary", body: "A synthetic newspaper body", category: "community", importance: 5, citationIds: [], isBreaking: false }] };
    } else throw new Error(`Unexpected provider schema ${name}`);
    return Response.json({ choices: [{ message: { content: JSON.stringify(data) } }], usage: { total_tokens: 2 } });
  });

  const { initDb, getDb } = await import("./db.js");
  const { ingestionRouter } = await import("./routers/ingestion.js");
  const { ingestionSources, ingestionRuns, ingestionSchedule } = await import("../drizzle/schema.js");
  const { writeSettings } = await import("./_core/settings.js");
  await initDb();
  writeSettings({ activeProvider: "openai", openaiApiKey: "synthetic-key", rateLimitEnabled: false });
  const db = getDb();
  const caller = ingestionRouter.createCaller({ user: { id: 1, tier: "owner" }, req: {}, res: {} } as TrpcContext);
  const feed = (prefix: string, count: number) => `<rss><channel>${Array.from({ length: count }, (_, i) => `<item><title>${prefix} record ${i}</title><description>Public meeting</description><link>https://example.invalid/${prefix}/${i}</link></item>`).join("")}</channel></rss>`;
  await db.insert(ingestionSchedule).values({ id: 1, enabled: false });
  for (const [name, count] of [["first", 2], ["second", 3], ["empty", 0]] as const) {
    bodies.set(`/${name}`, { body: feed(name, count) });
    await caller.addSource({ name, url: `https://93.184.216.34/${name}`, type: "rss", city: "Kingman", category: "government", sourceLabel: name });
  }

  await t.test("manual pipeline counts each source independently and honors disabled news generation", async () => {
    const result = await caller.runPipeline({ generateNews: false });
    assert.equal(result.totalDocumentsAnalyzed, 5);
    assert.equal(newsCalls, 0);
    const sources = await db.select().from(ingestionSources).orderBy(ingestionSources.id);
    assert.deepEqual(sources.map((source) => source.documentCount), [2, 3, 0]);
    await caller.runPipeline({ generateNews: false });
    assert.deepEqual((await db.select().from(ingestionSources).orderBy(ingestionSources.id)).map((source) => source.documentCount), [2, 3, 0]);
  });

  await t.test("manual news generation persists article/token totals and errors", async () => {
    bodies.set("/empty", { body: feed("new", 1) });
    const generated = await caller.runPipeline({ generateNews: true });
    assert.equal(generated.articlesGenerated, 1);
    assert.equal(newsCalls, 1);
    const [run] = await db.select().from(ingestionRuns).where(eq(ingestionRuns.id, generated.runId!));
    assert.equal(run.articlesGenerated, 1);
    assert.equal(run.tokensUsed, 8);
    assert.equal(run.status, "completed");
    rejectNews = true;
    bodies.set("/empty", { body: feed("later", 1) });
    const failed = await caller.runPipeline();
    const [failedRun] = await db.select().from(ingestionRuns).where(eq(ingestionRuns.id, failed.runId!));
    assert.equal(failedRun.status, "partial");
    assert.equal(failedRun.articlesGenerated, 0);
    assert.match(failedRun.log!.join("\n"), /NEWS FAILED/);
  });

  await t.test("manual RSS and webpage redirects fail before private fetch or model calls", async () => {
    for (const type of ["rss", "webpage"] as const) {
      bodies.set(`/redirect-${type}`, { status: 302, location: "http://127.0.0.1/private" });
      const source = await caller.addSource({ name: type, url: `https://93.184.216.34/redirect-${type}`, type, city: "Kingman", category: "government", sourceLabel: "fixture" });
      const beforeProvider = providerCalls;
      const beforeRequests = sourceRequests.length;
      await assert.rejects(caller.runSource({ sourceId: source.id }), /public Internet/);
      assert.equal(sourceRequests.length, beforeRequests + 1);
      assert.equal(providerCalls, beforeProvider);
      const [saved] = await db.select().from(ingestionSources).where(eq(ingestionSources.id, source.id));
      assert.equal(saved.consecutiveFailures, 1);
    }
  });

  await t.test("scheduled adapters reject redirects and malformed feeds and retain failed digest timestamp", async () => {
    await db.update(ingestionSources).set({ enabled: false });
    for (const type of ["rss", "webpage"] as const) {
      const [source] = await db.select().from(ingestionSources).where(eq(ingestionSources.name, type));
      await db.update(ingestionSources).set({ enabled: true }).where(eq(ingestionSources.id, source.id));
    }
    bodies.set("/malformed", { body: `<rss>${"<entry>".repeat(16_000)}` });
    await caller.addSource({ name: "malformed", url: "https://93.184.216.34/malformed", type: "rss", city: "Kingman", category: "government", sourceLabel: "fixture" });
    const oldDigest = new Date(Date.now() - 14 * 86400_000);
    await db.update(ingestionSchedule).set({ enabled: true, lastRunAt: null, autoGenerateNews: false, weeklyDigestEnabled: true, digestDayOfWeek: new Date().getDay(), lastDigestSentAt: oldDigest });
    const { startScheduler, stopScheduler } = await import("./scheduler.js");
    const beforeProvider = providerCalls;
    const previousRuns = (await db.select().from(ingestionRuns)).length;
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    startScheduler();
    t.mock.timers.tick(10_000);
    let complete = false;
    for (let tries = 0; tries < 50; tries++) {
      await pause(20);
      const runs = await db.select().from(ingestionRuns);
      if (runs.length > previousRuns && runs.at(-1)!.status !== "running") { complete = true; break; }
    }
    // Let the digest step finish after ingestion-run completion is recorded.
    await pause(40);
    stopScheduler();
    t.mock.timers.reset();
    assert.equal(complete, true);
    assert.equal(providerCalls, beforeProvider);
    const [schedule] = await db.select().from(ingestionSchedule);
    assert.equal(schedule.lastDigestSentAt?.getTime(), Math.floor(oldDigest.getTime() / 1000) * 1000);
    const enabled = (await db.select().from(ingestionSources)).filter((source) => source.enabled);
    assert.ok(enabled.every((source) => source.consecutiveFailures >= 1));
  });
});
