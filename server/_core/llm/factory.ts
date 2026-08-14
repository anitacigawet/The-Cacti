import type { LLMProvider, SupportedProvider } from "./types.js";
import { DEFAULT_PROVIDER, DEFAULT_MODEL_BY_PROVIDER, SUPPORTED_PROVIDERS } from "./types.js";
import { GeminiProvider } from "./providers/gemini.js";
import { OpenAIProvider } from "./providers/openai.js";
import { DeepSeekProvider } from "./providers/deepseek.js";
import { readSettings } from "../settings.js";
import { ENV } from "../env.js";

let providerInstance: LLMProvider | null = null;
let providerKey: string | null = null;

function resolveActiveProvider(): SupportedProvider {
  const fromSettings = readSettings().activeProvider;
  if (fromSettings && (SUPPORTED_PROVIDERS as readonly string[]).includes(fromSettings)) {
    return fromSettings;
  }
  if (ENV.activeProvider && (SUPPORTED_PROVIDERS as readonly string[]).includes(ENV.activeProvider)) {
    return ENV.activeProvider as SupportedProvider;
  }
  return DEFAULT_PROVIDER;
}

function instantiate(name: SupportedProvider): LLMProvider {
  switch (name) {
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "deepseek":
      return new DeepSeekProvider();
  }
}

export function getLLMProvider(): LLMProvider {
  const active = resolveActiveProvider();
  if (!providerInstance || providerKey !== active) {
    providerInstance = instantiate(active);
    providerKey = active;
    console.log(`[LLM] Provider initialized: ${active}`);
  }
  return providerInstance;
}

export function getProviderInfo(): { name: SupportedProvider; model: string } {
  const active = resolveActiveProvider();
  const settings = readSettings();
  const model =
    (active === "gemini" ? settings.geminiModel : undefined) ??
    (active === "openai" ? settings.openaiModel : undefined) ??
    (active === "deepseek" ? settings.deepseekModel : undefined) ??
    (active === "gemini" ? ENV.geminiModel : undefined) ??
    (active === "openai" ? ENV.openaiModel : undefined) ??
    (active === "deepseek" ? ENV.deepseekModel : undefined) ??
    DEFAULT_MODEL_BY_PROVIDER[active];
  return { name: active, model };
}

export function resetProvider(): void {
  providerInstance = null;
  providerKey = null;
}
