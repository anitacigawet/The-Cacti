export type {
  Role,
  TextContent,
  ImageContent,
  FileContent,
  MessageContent,
  Message,
  Tool,
  ToolChoicePrimitive,
  ToolChoiceByName,
  ToolChoiceExplicit,
  ToolChoice,
  InvokeParams,
  ToolCall,
  InvokeResult,
  JsonSchema,
  OutputSchema,
  ResponseFormat,
  LLMProvider,
  LLMProviderConfig,
  SupportedProvider,
} from "./llm/types.js";

import { getLLMProvider, getProviderInfo, resetProvider } from "./llm/factory.js";

export { getLLMProvider, getProviderInfo, resetProvider };

export { DeepSeekProvider } from "./llm/providers/deepseek.js";

export async function invokeLLM(
  params: import("./llm/types.js").InvokeParams
): Promise<import("./llm/types.js").InvokeResult> {
  const provider = getLLMProvider();
  return provider.generate(params);
}
