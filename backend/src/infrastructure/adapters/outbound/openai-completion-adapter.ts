import OpenAI from "openai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResponse,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

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

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.getClient().chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: request.prompt }],
      response_format: { type: "json_object" },
    });

    return { text: response.choices[0]?.message.content ?? "" };
  }
}
