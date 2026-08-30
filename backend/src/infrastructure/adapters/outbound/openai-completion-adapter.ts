import OpenAI from "openai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResponse,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

export class OpenAiCompletionAdapter implements AiCompletionPort {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = aiModelsConfig.openai) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: request.prompt }],
      response_format: { type: "json_object" },
    });

    return { text: response.choices[0]?.message.content ?? "" };
  }
}
