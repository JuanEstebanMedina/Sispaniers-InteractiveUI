import OpenAI from "openai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResult,
  AiToolDefinition,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

function toOpenAiTools(tools: AiToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * reasoning_effort only exists on the reasoning families. Every other model
 * rejects the whole request with a 400 ("Unrecognized request argument"), so
 * the parameter has to follow the configured model, not the code's default.
 */
const REASONING_MODEL_PREFIXES = ["gpt-5", "o1", "o3", "o4"];

function supportsReasoningEffort(model: string): boolean {
  return REASONING_MODEL_PREFIXES.some((prefix) => model.startsWith(prefix));
}

/**
 * The client is built on first use, not in the constructor.
 *
 * `new OpenAI({})` throws when the key is missing, and the composition root
 * builds this adapter unconditionally — so an absent key used to kill the whole
 * process at boot, taking down the operations API, which needs no AI at all.
 * Deferring it moves the failure to the call, where `FallbackAiCompletionAdapter`
 * already knows how to handle it.
 */
export class OpenAiCompletionAdapter implements AiCompletionPort {
  private client: OpenAI | undefined;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = aiModelsConfig.openai) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private getClient(): OpenAI {
    this.client ??= new OpenAI({ apiKey: this.apiKey });
    return this.client;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const hasTools = request.tools !== undefined && request.tools.length > 0;
    const forceTool = request.forceTool ?? true;

    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [
        ...(request.systemPrompt === undefined
          ? []
          : [{ role: "developer" as const, content: request.systemPrompt }]),
        { role: "user", content: request.prompt },
      ],
      ...(supportsReasoningEffort(this.model) ? { reasoning_effort: "none" as const } : {}),
      // "required" forces an actual function call whenever tools are offered
      // — left on "auto", the model is free to answer in plain prose, which
      // is right for a caller with a legitimate "nothing to show" case (see
      // `forceTool` on the port) and wrong everywhere else: prose that
      // describes a skill's own instructions back at the user is a real
      // thing it did otherwise.
      ...(hasTools
        ? {
            tools: toOpenAiTools(request.tools as AiToolDefinition[]),
            tool_choice:
              request.requiredToolName === undefined
                ? forceTool
                  ? "required"
                  : "auto"
                : { type: "function", function: { name: request.requiredToolName } },
          }
        : {}),
    });

    const message = response.choices[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    if (toolCall !== undefined && toolCall.type === "function") {
      try {
        return {
          kind: "tool_call",
          toolName: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        };
      } catch {
        return { kind: "text", text: toolCall.function.arguments };
      }
    }

    return { kind: "text", text: message?.content ?? "" };
  }
}
