import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc.js";
import { readSettings, writeSettings, clearSettingsKey } from "../_core/settings.js";
import { ENV } from "../_core/env.js";
import {
  SUPPORTED_PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL_BY_PROVIDER,
  type SupportedProvider,
} from "../_core/llm/types.js";
import { resetProvider, getLLMProvider, createLLMProvider } from "../_core/llm/factory.js";

function redact(key: string | undefined): string | null {
  if (!key) return null;
  return `${key.slice(0, 6)}…REDACTED`;
}

function resolveActiveProvider(): SupportedProvider {
  const s = readSettings();
  if (s.activeProvider && (SUPPORTED_PROVIDERS as readonly string[]).includes(s.activeProvider)) {
    return s.activeProvider;
  }
  if (ENV.activeProvider && (SUPPORTED_PROVIDERS as readonly string[]).includes(ENV.activeProvider)) {
    return ENV.activeProvider as SupportedProvider;
  }
  return DEFAULT_PROVIDER;
}

const providerEnum = z.enum(["gemini", "openai", "deepseek"]);

export const settingsRouter = router({
  get: publicProcedure.query(() => {
    const s = readSettings();
    const active = resolveActiveProvider();
    return {
      activeProvider: active,
      gemini: {
        hasKey: !!s.geminiApiKey,
        apiKey: redact(s.geminiApiKey),
        model: s.geminiModel || ENV.geminiModel || DEFAULT_MODEL_BY_PROVIDER.gemini,
      },
      openai: {
        hasKey: !!s.openaiApiKey,
        apiKey: redact(s.openaiApiKey),
        model: s.openaiModel || ENV.openaiModel || DEFAULT_MODEL_BY_PROVIDER.openai,
      },
      deepseek: {
        hasKey: !!s.deepseekApiKey,
        apiKey: redact(s.deepseekApiKey),
        model: s.deepseekModel || ENV.deepseekModel || DEFAULT_MODEL_BY_PROVIDER.deepseek,
      },
      rateLimitEnabled: s.rateLimitEnabled ?? false,
      rateLimitPerSecond: s.rateLimitPerSecond ?? 1,
    };
  }),

  save: adminProcedure
    .input(
      z.object({
        activeProvider: providerEnum.optional(),
        geminiApiKey: z.string().optional(),
        geminiModel: z.string().min(1).max(120).optional(),
        openaiApiKey: z.string().optional(),
        openaiModel: z.string().min(1).max(120).optional(),
        deepseekApiKey: z.string().optional(),
        deepseekModel: z.string().min(1).max(120).optional(),
        rateLimitEnabled: z.boolean().optional(),
        rateLimitPerSecond: z.number().min(0).max(1000).optional(),
      })
    )
    .mutation(({ input }) => {
      writeSettings(input);
      // Force the next request to pick up new active-provider / key / model.
      resetProvider();
      return { success: true };
    }),

  clearKey: adminProcedure
    .input(z.object({ provider: providerEnum }))
    .mutation(({ input }) => {
      const field = `${input.provider}ApiKey` as const;
      clearSettingsKey(field);
      resetProvider();
      return { success: true };
    }),

  testConnection: adminProcedure
    .input(z.object({ provider: providerEnum }).optional())
    .mutation(async ({ input }) => {
      const provider = input?.provider
        ? createLLMProvider(input.provider)
        : getLLMProvider();
      return await provider.testConnection();
    }),
});
