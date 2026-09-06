import { readSettings } from "../../settings.js";
import { ENV } from "../../env.js";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_THINKING_BUDGET_TOKENS,
} from "../../llm-defaults.js";
import { rateLimiter } from "../rate-limiter.js";
import type {
  InvokeParams,
  InvokeResult,
  LLMProvider,
  Message,
  Tool,
  ToolChoice,
  ResponseFormat,
  OutputSchema,
} from "../types.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

export class GeminiProvider implements LLMProvider {
  private resolveKey(): string {
    const key = readSettings().geminiApiKey || ENV.geminiApiKey || "";
    if (!key) {
      throw new Error(
        "Gemini API key is not configured. Set it via the Settings page or GEMINI_API_KEY in .env."
      );
    }
    return key;
  }

  private resolveModel(): string {
    return readSettings().geminiModel || ENV.geminiModel;
  }

  private toText(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "type" in part) {
            const p = part as { type: string; text?: string };
            if (p.type === "text" && typeof p.text === "string") return p.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  private convertMessages(messages: Message[]): {
    system?: string;
    contents: GeminiContent[];
  } {
    const systemPieces: string[] = [];
    const contents: GeminiContent[] = [];

    for (const m of messages) {
      if (m.role === "system") {
        systemPieces.push(this.toText(m.content));
        continue;
      }
      if (m.role === "tool" || m.role === "function") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: m.name ?? m.tool_call_id ?? "tool",
                response: { content: this.toText(m.content) },
              },
            },
          ],
        });
        continue;
      }
      const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
      const parts: GeminiPart[] = [];
      const items = Array.isArray(m.content) ? m.content : [m.content];
      for (const item of items) {
        if (typeof item === "string") {
          if (item) parts.push({ text: item });
          continue;
        }
        if (item && typeof item === "object" && "type" in item) {
          const t = (item as { type: string }).type;
          if (t === "text") {
            const text = (item as { text: string }).text;
            if (text) parts.push({ text });
          } else if (t === "image_url") {
            const url = (item as { image_url: { url: string } }).image_url.url;
            const match = /^data:([^;]+);base64,(.*)$/.exec(url);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            } else {
              parts.push({ text: `[image: ${url}]` });
            }
          }
        }
      }
      if (parts.length === 0) parts.push({ text: "" });
      contents.push({ role, parts });
    }

    return {
      system: systemPieces.length > 0 ? systemPieces.join("\n\n") : undefined,
      contents,
    };
  }

  private convertTools(tools?: Tool[]): unknown[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  private convertToolChoice(choice?: ToolChoice): unknown {
    if (!choice) return undefined;
    if (typeof choice === "string") {
      const map: Record<string, string> = { auto: "AUTO", required: "ANY", none: "NONE" };
      const mode = map[choice];
      return mode ? { functionCallingConfig: { mode } } : undefined;
    }
    if (typeof choice === "object" && "name" in choice) {
      return { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [choice.name] } };
    }
    if (typeof choice === "object" && "function" in choice) {
      return {
        functionCallingConfig: { mode: "ANY", allowedFunctionNames: [choice.function.name] },
      };
    }
    return undefined;
  }

  private buildResponseConfig(
    responseFormat?: ResponseFormat,
    response_format?: ResponseFormat,
    outputSchema?: OutputSchema,
    output_schema?: OutputSchema
  ): { responseMimeType?: string; responseSchema?: Record<string, unknown> } {
    const fmt = responseFormat ?? response_format;
    const schema = outputSchema ?? output_schema;
    if (fmt?.type === "json_schema") {
      return {
        responseMimeType: "application/json",
        responseSchema: this.sanitizeSchema(fmt.json_schema.schema),
      };
    }
    if (fmt?.type === "json_object") {
      return { responseMimeType: "application/json" };
    }
    if (schema) {
      return {
        responseMimeType: "application/json",
        responseSchema: this.sanitizeSchema(schema.schema),
      };
    }
    return {};
  }

  /** Strip JSON Schema fields Gemini's responseSchema doesn't accept. */
  private sanitizeSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return {};
    const allowed = new Set([
      "type",
      "format",
      "description",
      "nullable",
      "enum",
      "properties",
      "required",
      "items",
      "minItems",
      "maxItems",
      "minimum",
      "maximum",
      "minLength",
      "maxLength",
      "pattern",
      "propertyOrdering",
    ]);
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (!allowed.has(key)) continue;
      if (key === "properties") {
        // Property names are application data, not schema keywords.
        if (value && typeof value === "object" && !Array.isArray(value)) {
          out.properties = Object.fromEntries(
            Object.entries(value).map(([name, definition]) => [
              name,
              this.sanitizeSchema(definition),
            ])
          );
        }
      } else if (key === "items") {
        out.items = this.sanitizeSchema(value);
      } else {
        out[key] = value;
      }
    }
    return out;
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

    const { system, contents } = this.convertMessages(messages);
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS,
      thinkingConfig: { thinkingBudget: DEFAULT_THINKING_BUDGET_TOKENS },
    };
    Object.assign(
      generationConfig,
      this.buildResponseConfig(responseFormat, response_format, outputSchema, output_schema)
    );

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const geminiTools = this.convertTools(tools);
    if (geminiTools) body.tools = geminiTools;
    const toolConfig = this.convertToolChoice(toolChoice ?? tool_choice);
    if (toolConfig) body.toolConfig = toolConfig;

    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText} – ${errorText}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    return this.toInvokeResult(data, model);
  }

  private toInvokeResult(
    data: {
      candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    },
    model: string
  ): InvokeResult {
    const choices = (data.candidates ?? []).map((cand, index) => {
      const parts = cand.content?.parts ?? [];
      const textParts: string[] = [];
      const toolCalls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }> = [];
      let toolIdx = 0;
      for (const part of parts) {
        if ("text" in part && part.text) textParts.push(part.text);
        else if ("functionCall" in part && part.functionCall) {
          toolCalls.push({
            id: `call_${toolIdx++}`,
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            },
          });
        }
      }
      return {
        index,
        message: {
          role: "assistant" as const,
          content: textParts.join(""),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: this.mapFinishReason(cand.finishReason),
      };
    });

    return {
      id: `gemini-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model,
      choices,
      usage: data.usageMetadata
        ? {
            prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
            completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
            total_tokens: data.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  private mapFinishReason(reason?: string): string | null {
    if (!reason) return null;
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
      case "RECITATION":
        return "content_filter";
      case "TOOL_CALLS":
        return "tool_calls";
      default:
        return reason.toLowerCase();
    }
  }

  getName(): string {
    return "gemini";
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.generate({
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 5,
      });
      return { success: true, message: `Connected to Gemini (${result.model})` };
    } catch (error) {
      return {
        success: false,
        message: `Gemini connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
