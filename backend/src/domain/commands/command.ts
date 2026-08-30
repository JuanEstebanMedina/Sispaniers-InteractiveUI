import type { JsonSchema } from "./json-schema.js";

export interface CommandContext {
  operationId: string;
}

export interface Command {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly skill?: string;
  execute(input: unknown, context: CommandContext): Promise<unknown>;
}
