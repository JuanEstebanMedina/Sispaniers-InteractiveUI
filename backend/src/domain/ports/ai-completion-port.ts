import type { JsonSchema } from "../commands/json-schema.js";

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface AiCompletionRequest {
  prompt: string;
  systemPrompt?: string;
  tools?: AiToolDefinition[];
  /**
   * Whether the model must call one of `tools` rather than answer in prose.
   * Defaults to true. A caller that has a legitimate "nothing to show" case
   * (chat: the user asked for data that doesn't exist) sets this to false so
   * the model can say so in plain text instead of being forced to materialize
   * an empty or near-empty component just to satisfy the tool call.
   */
  forceTool?: boolean;
  /**
   * Require one named tool. Use only when application behavior needs an
   * executable outcome, not merely a tool-shaped model response.
   */
  requiredToolName?: string;
}

export type AiCompletionResult =
  | { kind: "tool_call"; toolName: string; input: unknown }
  | { kind: "text"; text: string };

export interface AiCompletionPort {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
