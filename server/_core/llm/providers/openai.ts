import { readSettings } from "../../settings.js";
import { ENV } from "../../env.js";
import { DEFAULT_MAX_TOKENS } from "../../llm-defaults.js";
import { rateLimiter } from "../rate-limiter.js";
import type {
  InvokeParams,
  InvokeResult,
  LLMProvider,
  ResponseFormat,
  OutputSchema,
  ToolChoice,
} from "../types.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements LLMProvider {
  private resolveKey(): string {
    const key = readSettings().openaiApiKey || ENV.openaiApiKey || "";
    if (!key) {
      throw new Error(
        "OpenAI API key is not configured. Set it via the Settings page or OPENAI_API_KEY in .env."
      );
    }
    return key;
  }

  private resolveModel(): string {
    return readSettings().openaiModel || ENV.openaiModel;
  }

  private normalizeToolChoice(choice: ToolChoice | undefined): unknown {
    if (!choice) return undefined;
    if (typeof choice === "string") return choice;
    if (typeof choice === "object" && "name" in choice) {
      return { type: "function", function: { name: choice.name } };
    }
    return choice;
  }

  private normalizeResponseFormat(
    responseFormat?: ResponseFormat,
    response_format?: ResponseFormat,
    outputSchema?: OutputSchema,
    output_schema?: OutputSchema
  ): unknown {
    const fmt = responseFormat ?? response_format;
    if (fmt) return fmt;
    const schema = outputSchema ?? output_schema;
    if (schema) {
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          strict: schema.strict ?? true,
        },
      };
    }
    return undefined;
  }

  /** Models in the o-series and gpt-5 family use `max_completion_tokens` rather than `max_tokens`. */
  private maxTokensField(model: string): "max_tokens" | "max_completion_tokens" {
    if (/^o\d|^gpt-5/i.test(model)) return "max_completion_tokens";
    return "max_tokens";
  }

  async generate(params: InvokeParams): Promise<InvokeResult> {
    const apiKey = this.resolveKey();
    const model = this.resolveModel();

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

    const payload: Record<string, unknown> = { model, messages };
    payload[this.maxTokensField(model)] = maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS;

    if (tools && tools.length > 0) payload.tools = tools;
    const tc = this.normalizeToolChoice(toolChoice ?? tool_choice);
    if (tc) payload.tool_choice = tc;
    const rf = this.normalizeResponseFormat(
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    );
    if (rf) payload.response_format = rf;

    const response = await fetch(OPENAI_URL, {
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
        `OpenAI API error: ${response.status} ${response.statusText} – ${errorText}`
      );
    }

    return (await response.json()) as InvokeResult;
  }

  getName(): string {
    return "openai";
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.generate({
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 5,
      });
      return { success: true, message: `Connected to OpenAI (${result.model})` };
    } catch (error) {
      return {
        success: false,
        message: `OpenAI connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
