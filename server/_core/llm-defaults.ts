/**
 * LLM defaults shared across all providers.
 *
 * The application's prompts, JSON-schema response formats, and downstream
 * parsing were tuned against Gemini 2.5 Flash with a 32k max_tokens budget
 * and a small thinking allocation. These constants pin those defaults so
 * each provider transport can reproduce the same effective request shape.
 *
 * Per-call overrides (passed via InvokeParams) always win over these defaults.
 */

export const DEFAULT_MODEL = "gemini-2.5-flash";
/**
 * Cross-provider safe default. gpt-4o-mini caps completion at 16384, so the
 * old 32768 default was rejected with 400. 4096 is plenty for our structured
 * analysis JSON (typically <2k tokens) and works on every provider.
 * Per-call overrides win.
 */
export const DEFAULT_MAX_TOKENS = 4096;

/**
 * Numeric thinking budget used by providers that accept one (e.g. Gemini's
 * `thinkingConfig.thinkingBudget`). 128 tokens is a small reasoning allocation
 * — enough to enable reasoning without inflating cost.
 */
export const DEFAULT_THINKING_BUDGET_TOKENS = 128;

/**
 * For providers that expose reasoning intensity as an enum rather than a
 * token budget (e.g. DeepSeek's `thinking.reasoning_effort`). "high" maps
 * to a small thinking allocation; "max" is the heavier setting.
 */
export const DEFAULT_REASONING_EFFORT: "high" | "max" = "high";
