import { GoogleGenAI } from "@google/genai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResponse,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

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

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.getClient().models.generateContent({
      model: this.model,
      contents: request.prompt,
    });

    return { text: response.text ?? "" };
  }
}
