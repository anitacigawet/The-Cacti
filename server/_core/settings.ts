import fs from "node:fs";
import path from "node:path";
import type { SupportedProvider } from "./llm/types.js";

const SETTINGS_PATH = path.resolve("./data/settings.json");

export type AppSettings = {
  activeProvider?: SupportedProvider;

  geminiApiKey?: string;
  geminiModel?: string;

  openaiApiKey?: string;
  openaiModel?: string;

  deepseekApiKey?: string;
  deepseekModel?: string;

  rateLimitEnabled?: boolean;
  rateLimitPerSecond?: number;
};

export function readSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {};
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as AppSettings;
  } catch {
    return {};
  }
}

export function writeSettings(updates: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const next = { ...current, ...updates };
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function clearSettingsKey(key: keyof AppSettings): AppSettings {
  const current = readSettings();
  delete current[key];
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2), "utf-8");
  return current;
}
