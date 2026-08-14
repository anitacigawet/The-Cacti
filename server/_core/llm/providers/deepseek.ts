import { readSettings } from "../../settings.js";
import { ENV } from "../../env.js";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_REASONING_EFFORT,
} from "../../llm-defaults.js";
import { rateLimiter } from "../rate-limiter.js";
import type {
  InvokeParams,
  InvokeResult,
  LLMProvider,
} from "../types.js";

// Per the official docs (https://api-docs.deepseek.com/api/create-chat-completion)
// the endpoint is /chat/completions with no /v1 prefix.
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export class DeepSeekProvider implements LLMProvider {
  private resolveKey(): string {
    const key = readSettings().deepseekApiKey || ENV.deepseekApiKey || "";
    if (!key) {
      throw new Error(
        "DeepSeek API key is not configured. Set it via the Settings page or DEEPSEEK_API_KEY in .env."
      );
    }
    return key;
  }

  private resolveModel(): string {
    return readSettings().deepseekModel || ENV.deepseekModel;
  }

  private normalizeMessage(message: {
    role: string;
    content: unknown;
    name?: string;
    tool_call_id?: string;
  }): Record<string, unknown> {
    const { role, name, tool_call_id } = message;

    if (role === "tool" || role === "function") {
      const content = this.ensureArray(message.content)
        .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
      return { role, name, tool_call_id, content };
    }

    const contentParts = this.ensureArray(message.content).map((part) =>
      this.normalizeContentPart(part)
    );

    if (
      contentParts.length === 1 &&
      typeof contentParts[0] === "object" &&
      contentParts[0] !== null &&
      "type" in contentParts[0] &&
      contentParts[0].type === "text"
    ) {
      return { role, name, content: (contentParts[0] as { text: string }).text };
    }

    return { role, name, content: contentParts };
  }

  private ensureArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [value];
  }

  private normalizeContentPart(
    part: unknown
  ): { type: string; text?: string; image_url?: { url: string } } {
    if (typeof part === "string") return { type: "text", text: part };
    if (typeof part === "object" && part !== null) {
      const p = part as Record<string, unknown>;
      if (p.type === "text") return { type: "text", text: String(p.text || "") };
      if (p.type === "image_url") {
        const imageUrl = p.image_url as Record<string, string> | undefined;
        return { type: "image_url", image_url: { url: imageUrl?.url || "" } };
      }
    }
    return { type: "text", text: String(part) };
  }

  private normalizeToolChoice(
    toolChoice: unknown,
    tools: unknown[] | undefined
  ): "none" | "auto" | { type: "function"; function: { name: string } } | undefined {
    if (!toolChoice) return undefined;
    if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
    if (toolChoice === "required") {
      if (!tools || tools.length === 0) throw new Error("tool_choice 'required' requires tools");
      if (tools.length > 1) throw new Error("tool_choice 'required' needs a single tool");
      const firstTool = tools[0] as { function?: { name?: string } };
      return { type: "function", function: { name: firstTool?.function?.name || "" } };
    }
    if (typeof toolChoice === "object" && toolChoice !== null && "name" in toolChoice) {
      return { type: "function", function: { name: (toolChoice as { name: string }).name } };
    }
    return toolChoice as { type: "function"; function: { name: string } };
  }

  private normalizeResponseFormat(params: {
    responseFormat?: unknown;
    response_format?: unknown;
    outputSchema?: unknown;
    output_schema?: unknown;
  }):
    | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } }
    | { type: "text" }
    | { type: "json_object" }
    | undefined {
    const explicitFormat = params.responseFormat || params.response_format;
    if (explicitFormat) {
      return explicitFormat as
        | { type: "text" }
        | { type: "json_object" }
        | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };
    }
    const schema = params.outputSchema || params.output_schema;
    if (!schema) return undefined;
    const s = schema as { name?: string; schema?: Record<string, unknown>; strict?: boolean };
    if (!s.name || !s.schema) throw new Error("outputSchema requires both name and schema");
    return {
      type: "json_schema",
      json_schema: {
        name: s.name,
        schema: s.schema,
        ...(typeof s.strict === "boolean" ? { strict: s.strict } : {}),
      },
    };
  }

  /**
   * Append the JSON schema (and a "respond with JSON" instruction) to the
   * system message so DeepSeek's loose `json_object` mode produces the right
   * shape. If no system message exists, prepends one.
   *
   * DeepSeek requires the literal word "json" in the prompt for json_object
   * mode; we always include it via the instruction text.
   */
  private injectJsonSchemaIntoSystem(
    messages: Array<Record<string, unknown>>,
    schemaInfo: { name: string; schema: Record<string, unknown>; strict?: boolean }
  ): Array<Record<string, unknown>> {
    const instruction =
      `Respond ONLY with a single JSON object that matches this schema (no prose, no markdown fences):\n` +
      `Schema name: ${schemaInfo.name}\n` +
      `Schema:\n${JSON.stringify(schemaInfo.schema, null, 2)}`;

    const result = messages.map((m) => ({ ...m }));
    const systemIdx = result.findIndex((m) => m.role === "system");

    if (systemIdx >= 0) {
      const existing = result[systemIdx].content;
      const existingText = typeof existing === "string"
        ? existing
        : Array.isArray(existing)
          ? existing
              .map((p) => (typeof p === "string" ? p : (p as { text?: string }).text || ""))
              .join("\n")
          : String(existing ?? "");
      result[systemIdx] = {
        ...result[systemIdx],
        content: `${existingText}\n\n${instruction}`,
      };
    } else {
      result.unshift({ role: "system", content: instruction });
    }
    return result;
  }

  async generate(params: InvokeParams): Promise<InvokeResult> {
    const apiKey = this.resolveKey();
    const model = this.resolveModel();

    // Apply rate limiting if enabled in settings.
    const settings = readSettings();
    if (settings.rateLimitEnabled && (settings.rateLimitPerSecond ?? 0) > 0) {
      await rateLimiter.acquire(settings.rateLimitPerSecond ?? 1);
    }

    const {
      messages,
      tools,
      toolChoice,
      tool_choice,
      outputSchema,
      output_schema,
      responseFormat,
      response_format,
      maxTokens,
      max_tokens,
    } = params;

    const payload: Record<string, unknown> = {
      model,
      messages: messages.map((m) =>
        this.normalizeMessage(m as { role: string; content: unknown; name?: string; tool_call_id?: string })
      ),
    };

    if (tools && tools.length > 0) payload.tools = tools;

    const normalizedToolChoice = this.normalizeToolChoice(toolChoice || tool_choice, tools);
    if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

    // Seed max_tokens and the thinking parameter from llm-defaults. DeepSeek's
    // V4 API takes thinking as `{ type: "enabled" | "disabled",
    // reasoning_effort: "high" | "max" }` (low/medium are aliased to high per
    // the docs). Per-call overrides still win.
    payload.max_tokens = maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS;
    payload.thinking = { type: "enabled", reasoning_effort: DEFAULT_REASONING_EFFORT };

    const normalizedResponseFormat = this.normalizeResponseFormat({
      responseFormat,
      response_format,
      outputSchema,
      output_schema,
    });
    if (normalizedResponseFormat) {
      // DeepSeek's chat completions API only accepts `{ type: "text" }` or
      // `{ type: "json_object" }` — strict `json_schema` (OpenAI-style) is
      // rejected with HTTP 400 "This response_format type is unavailable now".
      //
      // The app's call sites pass `json_schema` because they're tuned for
      // strict structured-output (Gemini/OpenAI style). Rather than rewriting
      // every call site (and losing schema info), we transparently downgrade
      // here:
      //
      //   1. Send `response_format: { type: "json_object" }` to DeepSeek.
      //   2. Inject the schema (and an instruction to follow it) into the
      //      system prompt as plain text so the model still has the target
      //      shape. DeepSeek also requires the word "json" in the prompt for
      //      JSON mode to work — we add that explicitly.
      //
      // See: https://api-docs.deepseek.com/guides/json_mode
      if (normalizedResponseFormat.type === "json_schema") {
        const schemaInfo = normalizedResponseFormat.json_schema;
        payload.response_format = { type: "json_object" };
        payload.messages = this.injectJsonSchemaIntoSystem(
          payload.messages as Array<Record<string, unknown>>,
          schemaInfo
        );
      } else {
        payload.response_format = normalizedResponseFormat;
      }
    }

    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} – ${errorText}`
      );
    }

    return (await response.json()) as InvokeResult;
  }

  getName(): string {
    return "deepseek";
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.generate({
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 5,
      });
      return { success: true, message: `Connected to DeepSeek (${result.model})` };
    } catch (error) {
      return {
        success: false,
        message: `DeepSeek connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
