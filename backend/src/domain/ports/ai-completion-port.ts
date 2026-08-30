import type { JsonSchema } from "../commands/json-schema.js";

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface AiCompletionRequest {
  prompt: string;
  tools?: AiToolDefinition[];
}

export type AiCompletionResult =
  | { kind: "tool_call"; toolName: string; input: unknown }
  | { kind: "text"; text: string };

export interface AiCompletionPort {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
