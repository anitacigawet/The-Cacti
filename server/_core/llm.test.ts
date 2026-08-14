import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("./env.js", () => ({
  ENV: {
    geminiApiKey: "test-gemini",
    geminiModel: "gemini-2.5-flash",
    openaiApiKey: "test-openai",
    openaiModel: "gpt-4o-mini",
    deepseekApiKey: "test-deepseek",
    deepseekModel: "deepseek-v4-flash",
    activeProvider: "",
    databasePath: "./data/app.db",
    port: 3000,
    isProduction: false,
  },
}));

let mockSettings: Record<string, unknown> = {};
vi.mock("./settings.js", () => ({
  readSettings: () => mockSettings,
}));

import {
  getLLMProvider,
  getProviderInfo,
  resetProvider,
  invokeLLM,
  DeepSeekProvider,
  GeminiProvider,
  OpenAIProvider,
} from "./llm/index.js";

global.fetch = vi.fn();

beforeEach(() => {
  mockSettings = {};
  resetProvider();
});

afterEach(() => {
  resetProvider();
  vi.restoreAllMocks();
});

describe("LLM provider factory", () => {
  it("defaults to GeminiProvider when nothing is configured", () => {
    const provider = getLLMProvider();
    expect(provider.getName()).toBe("gemini");
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it("returns same instance for repeated calls (singleton per active provider)", () => {
    const p1 = getLLMProvider();
    const p2 = getLLMProvider();
    expect(p1).toBe(p2);
  });

  it("switches provider when settings change", () => {
    mockSettings = { activeProvider: "openai" };
    const provider = getLLMProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("falls back to DeepSeek when configured", () => {
    mockSettings = { activeProvider: "deepseek" };
    const provider = getLLMProvider();
    expect(provider).toBeInstanceOf(DeepSeekProvider);
  });

  it("getProviderInfo reflects active provider and model", () => {
    mockSettings = { activeProvider: "openai", openaiModel: "gpt-4o" };
    const info = getProviderInfo();
    expect(info.name).toBe("openai");
    expect(info.model).toBe("gpt-4o");
  });
});

describe("DeepSeekProvider", () => {
  beforeEach(() => {
    mockSettings = { activeProvider: "deepseek" };
  });

  it("generates completion with correct payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "gen-test",
        created: Date.now(),
        model: "deepseek-v4-flash",
        choices: [{ index: 0, message: { role: "assistant", content: "Hello!" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as Response);

    const provider = new DeepSeekProvider();
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }] });

    expect(result.choices[0].message.content).toBe("Hello!");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("api.deepseek.com"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("testConnection returns failure on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    const provider = new DeepSeekProvider();
    const result = await provider.testConnection();
    expect(result.success).toBe(false);
  });
});

describe("GeminiProvider", () => {
  it("posts to generativelanguage.googleapis.com", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: "Hi from Gemini" }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 3, totalTokenCount: 4 },
      }),
    } as Response);

    const provider = new GeminiProvider();
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }] });
    expect(result.choices[0].message.content).toBe("Hi from Gemini");
    expect(result.usage?.total_tokens).toBe(4);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).toContain(":generateContent");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toBe("Hi");
  });

  it("hoists system messages into systemInstruction", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
      }),
    } as Response);

    const provider = new GeminiProvider();
    await provider.generate({
      messages: [
        { role: "system", content: "You are a cactus." },
        { role: "user", content: "Hi" },
      ],
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.systemInstruction.parts[0].text).toBe("You are a cactus.");
    expect(body.contents).toHaveLength(1);
  });
});

describe("OpenAIProvider", () => {
  it("posts to api.openai.com chat completions", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "chatcmpl-1",
        created: Date.now(),
        model: "gpt-4o-mini",
        choices: [
          { index: 0, message: { role: "assistant", content: "Hi from OpenAI" }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 },
      }),
    } as Response);

    const provider = new OpenAIProvider();
    const result = await provider.generate({ messages: [{ role: "user", content: "Hi" }] });
    expect(result.choices[0].message.content).toBe("Hi from OpenAI");

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    expect((init as { headers: Record<string, string> }).headers.authorization).toBe(
      "Bearer test-openai"
    );
  });

  it("uses max_completion_tokens for o-series and gpt-5 models", async () => {
    mockSettings = { openaiModel: "gpt-5-mini" };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }] }),
    } as Response);

    const provider = new OpenAIProvider();
    await provider.generate({ messages: [{ role: "user", content: "Hi" }] });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.max_completion_tokens).toBeDefined();
    expect(body.max_tokens).toBeUndefined();
  });
});

describe("invokeLLM", () => {
  it("routes through the active provider", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Routed!" }] }, finishReason: "STOP" }],
      }),
    } as Response);

    const result = await invokeLLM({ messages: [{ role: "user", content: "Hi" }] });
    expect(result.choices[0].message.content).toBe("Routed!");
  });
});
