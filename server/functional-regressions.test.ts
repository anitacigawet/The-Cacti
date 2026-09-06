import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { TrpcContext } from "./_core/context.js";
import type { InvokeParams } from "./_core/llm/types.js";

test("functional backend regressions with an isolated runtime and mocked transport", async (t) => {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const originalCwd = process.cwd();
  const runtime = mkdtempSync(path.join(tmpdir(), "cacti-functional-test-"));
  const env = {
    DATABASE_PATH: path.join(runtime, "data", "app.db"),
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "gemini-test-model",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "openai-test-model",
    DEEPSEEK_API_KEY: "",
    DEEPSEEK_MODEL: "deepseek-test-model",
    LLM_PROVIDER: "gemini",
    OWNER_EMAIL: "owner@example.invalid",
    RESEND_API_KEY: "synthetic-email-key",
    RESEND_FROM_EMAIL: "sender@example.invalid",
  };
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  t.after(() => {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    // Only remove the uniquely created fixture, never the source runtime data.
    assert.equal(path.dirname(runtime), path.resolve(tmpdir()));
    assert.ok(path.basename(runtime).startsWith("cacti-functional-test-"));
    rmSync(runtime, { recursive: true, force: true });
  });

  Object.assign(process.env, env);
  cpSync(path.join(repository, "drizzle", "migrations"), path.join(runtime, "drizzle", "migrations"), { recursive: true });
  process.chdir(runtime);
  let transport: typeof fetch = async () => { throw new Error("Unexpected transport request in test"); };
  t.mock.method(globalThis, "fetch", (...args: Parameters<typeof fetch>) => transport(...args));
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  // Import after changing cwd and supplying synthetic environment values: both
  // settings and database modules resolve their runtime locations at import.
  const { initDb, getDb } = await import("./db.js");
  const { documents, ingestionSchedule } = await import("../drizzle/schema.js");
  const { writeSettings, readSettings } = await import("./_core/settings.js");
  const { getLLMProvider, resetProvider } = await import("./_core/llm/factory.js");
  const { GeminiProvider } = await import("./_core/llm/providers/gemini.js");
  const { rateLimiter, RateLimiter } = await import("./_core/llm/rate-limiter.js");
  const { intelligenceRouter } = await import("./routers/intelligence.js");
  const { settingsRouter } = await import("./routers/settings.js");
  const { ingestionRouter } = await import("./routers/ingestion.js");
  const { ENV } = await import("./_core/env.js");
  const ownerContext = { user: { id: 1, tier: "owner" }, req: {}, res: {} } as TrpcContext;
  const intelligence = intelligenceRouter.createCaller(ownerContext);
  const settings = settingsRouter.createCaller(ownerContext);
  const ingestion = ingestionRouter.createCaller(ownerContext);
  await initDb();
  const db = getDb();
  const geminiResponse = () => Response.json({
    candidates: [{ content: { parts: [{ text: "Synthetic response" }] }, finishReason: "STOP" }],
  });

  await t.test("daily brief handles empty data, older fallback and recent analyzed documents", async () => {
    const empty = await intelligence.dailyBrief();
    assert.equal(empty.totalDocuments, 0);
    assert.equal(empty.generated, false);
    const base = {
      content: "Synthetic civic document",
      source: "Fixture source",
      city: "Kingman",
      category: "civic",
      analysis: { Summary: "Synthetic summary", "Impact Level": "High" },
    };
    await db.insert(documents).values({
      ...base, title: "Older analyzed document", url: "https://example.invalid/older",
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    const fallback = await intelligence.dailyBrief();
    assert.equal(fallback.generated, false);
    assert.deepEqual(fallback.items.map((item) => item.title), ["Older analyzed document"]);
    await db.insert(documents).values([
      { ...base, title: "Recent analyzed document", url: "https://example.invalid/recent", publishedAt: new Date() },
      { ...base, title: "Unanalyzed document", url: "https://example.invalid/unanalyzed", analysis: null, publishedAt: new Date() },
    ]);
    const recent = await intelligence.dailyBrief();
    assert.equal(recent.generated, true);
    assert.equal(recent.totalDocuments, 1);
    assert.deepEqual(recent.items.map((item) => item.title), ["Recent analyzed document"]);
    assert.equal(recent.items[0].impactLevel, "High");
  });

  await t.test("Gemini outgoing structured requests retain named, nested and array properties", async () => {
    writeSettings({ geminiApiKey: "synthetic-gemini-key", rateLimitEnabled: false });
    const expected = {
      type: "object",
      properties: {
        IsArizona: { type: "boolean" },
        Summary: { type: "string", description: "A summary" },
        "Key Topics": { type: "array", items: { type: "string" } },
        Sentiment: { type: "object", properties: { Overall: { type: "string", enum: ["positive", "neutral"] }, Score: { type: "number", minimum: -1, maximum: 1 } }, required: ["Overall", "Score"] },
        People: { type: "array", items: { type: "string" } },
        articles: { type: "array", items: { type: "object", properties: { headline: { type: "string" }, citationIds: { type: "array", items: { type: "integer" } } }, required: ["headline", "citationIds"] } },
        type: { type: "string" },
        additionalProperties: { type: "boolean" },
      },
      required: ["IsArizona", "Summary", "Key Topics", "Sentiment", "People", "articles", "type", "additionalProperties"],
    };
    const sourceSchema = structuredClone(expected) as Record<string, any>;
    sourceSchema.$schema = "https://json-schema.org/draft/2020-12/schema";
    sourceSchema.additionalProperties = false;
    sourceSchema.properties.Sentiment.additionalProperties = false;
    sourceSchema.properties.articles.items.additionalProperties = false;
    const originalSchema = structuredClone(sourceSchema);
    const schema = { name: "fixture_schema", schema: sourceSchema, strict: true };
    const variants: Partial<InvokeParams>[] = [
      { response_format: { type: "json_schema", json_schema: schema } },
      { responseFormat: { type: "json_schema", json_schema: schema } },
      { output_schema: schema },
      { outputSchema: schema },
    ];
    const bodies: any[] = [];
    transport = async (url, init) => {
      assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
      bodies.push(JSON.parse(String(init?.body)));
      return geminiResponse();
    };
    for (const variant of variants) {
      await new GeminiProvider().generate({ messages: [{ role: "user", content: "Synthetic prompt" }], ...variant });
    }
    assert.equal(bodies.length, variants.length);
    for (const body of bodies) {
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.deepEqual(body.generationConfig.responseSchema, expected);
    }
    assert.deepEqual(sourceSchema, originalSchema);
    await new GeminiProvider().generate({ messages: [{ role: "user", content: "Plain JSON" }], response_format: { type: "json_object" } });
    assert.equal(bodies.at(-1).generationConfig.responseSchema, undefined);
  });

  await t.test("connection tests preserve saved provider and cached instance on success and failure", async () => {
    writeSettings({ activeProvider: "gemini", openaiApiKey: "synthetic-openai-key" });
    resetProvider();
    const active = getLLMProvider();
    const settingsPath = path.join(runtime, "data", "settings.json");
    const before = readFileSync(settingsPath, "utf8");
    assert.equal((await settings.get()).openai.hasKey, true);
    for (const succeeds of [false, true]) {
      transport = async (url) => {
        assert.match(String(url), /^https:\/\/api\.openai\.com\//);
        return succeeds ? Response.json({ model: "openai-test-model" }) : new Response("Synthetic failure", { status: 401 });
      };
      const result = await settings.testConnection({ provider: "openai" });
      assert.equal(result.success, succeeds);
      assert.equal(readFileSync(settingsPath, "utf8"), before);
      assert.equal(readSettings().activeProvider, "gemini");
      assert.equal(getLLMProvider(), active);
    }
    transport = async (url) => {
      assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
      return geminiResponse();
    };
    assert.equal((await settings.testConnection()).success, true);
    assert.equal(readFileSync(settingsPath, "utf8"), before);
  });

  await t.test("a pending connection test cannot overwrite an intentional provider change", async () => {
    let release!: (value: Response) => void;
    let reached!: () => void;
    const reachedProvider = new Promise<void>((resolve) => { reached = resolve; });
    transport = async (url) => {
      assert.match(String(url), /^https:\/\/api\.openai\.com\//);
      reached();
      return new Promise<Response>((resolve) => { release = resolve; });
    };
    const pending = settings.testConnection({ provider: "openai" });
    await reachedProvider;
    assert.equal(getLLMProvider().getName(), "gemini");
    await settings.save({ activeProvider: "deepseek" });
    release(new Response("Synthetic failure", { status: 500 }));
    assert.equal((await pending).success, false);
    assert.equal(readSettings().activeProvider, "deepseek");
    assert.equal(getLLMProvider().getName(), "deepseek");
  });

  await t.test("six concurrent owner queries obey one request per second", async () => {
    writeSettings({ activeProvider: "gemini", rateLimitEnabled: true, rateLimitPerSecond: 1 });
    resetProvider();
    rateLimiter.reset();
    const starts: number[] = [];
    transport = async (url) => {
      assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\//);
      starts.push(Date.now());
      return geminiResponse();
    };
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => intelligence.query({ question: `Synthetic query ${index}` })));
    assert.equal(results.length, 6);
    assert.equal(starts.length, 6);
    for (let index = 1; index < starts.length; index++) {
      // Small tolerance covers work between admission and mocked fetch.
      assert.ok(starts[index] - starts[index - 1] >= 990, `Provider calls ${index - 1}/${index} were too close`);
    }
    t.diagnostic(`Concurrent provider starts (ms): ${starts.map((at) => at - starts[0]).join(", ")}`);
    writeSettings({ rateLimitEnabled: false });
  });

  await t.test("rate limiter preserves multi-request capacity and FIFO admission", async () => {
    const limiter = new RateLimiter();
    const starts: { index: number; at: number }[] = [];
    await Promise.all(Array.from({ length: 5 }, async (_, index) => {
      await limiter.acquire(2);
      starts.push({ index, at: Date.now() });
    }));
    assert.deepEqual(starts.map((entry) => entry.index), [0, 1, 2, 3, 4]);
    for (let index = 2; index < starts.length; index++) {
      assert.ok(starts[index].at - starts[index - 2].at >= 990);
    }
  });

  await t.test("digest timestamp advances only after successful email delivery", async () => {
    const previousSentAt = new Date("2026-01-01T00:00:00Z");
    await db.insert(ingestionSchedule).values({ lastDigestSentAt: previousSentAt });
    const savedTimestamp = async () => (await db.select().from(ingestionSchedule))[0].lastDigestSentAt;
    let emailRequests = 0;
    transport = async (url) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      emailRequests++;
      return new Response("Synthetic send failure", { status: 500 });
    };
    assert.equal((await ingestion.sendDigest()).sent, false);
    assert.deepEqual(await savedTimestamp(), previousSentAt);
    assert.equal(emailRequests, 1);
    ENV.resendApiKey = "";
    assert.equal((await ingestion.sendDigest()).sent, false);
    assert.deepEqual(await savedTimestamp(), previousSentAt);
    assert.equal(emailRequests, 1);
    ENV.resendApiKey = "synthetic-email-key";
    transport = async () => { throw new Error("Synthetic transport failure"); };
    assert.equal((await ingestion.sendDigest()).sent, false);
    assert.deepEqual(await savedTimestamp(), previousSentAt);
    transport = async (url) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      return Response.json({ id: "synthetic-message-id" });
    };
    assert.equal((await ingestion.sendDigest()).sent, true);
    assert.ok((await savedTimestamp())!.getTime() > previousSentAt.getTime());
  });
});
