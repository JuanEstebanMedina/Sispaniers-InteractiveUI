import { type FunctionDeclaration, GoogleGenAI } from "@google/genai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResult,
  AiToolDefinition,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

function toFunctionDeclarations(tools: AiToolDefinition[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
  }));
}

/** Lazy for the same reason as `OpenAiCompletionAdapter` — see the note there. */
export class GeminiCompletionAdapter implements AiCompletionPort {
  private client: GoogleGenAI | undefined;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = aiModelsConfig.gemini) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): GoogleGenAI {
    this.client ??= new GoogleGenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await this.getClient().models.generateContent({
      model: this.model,
      contents: request.prompt,
      config: { tools: [{ functionDeclarations: toFunctionDeclarations(request.tools) }] },
    });

    const functionCall = response.functionCalls?.[0];
    if (functionCall?.name !== undefined) {
      return { kind: "tool_call", toolName: functionCall.name, input: functionCall.args ?? {} };
    }

    return { kind: "text", text: response.text ?? "" };
  }
}
