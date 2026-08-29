import { GoogleGenAI } from "@google/genai";

import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResponse,
} from "../../../domain/ports/ai-completion-port.js";
import { aiModelsConfig } from "../../config/ai-models.config.js";

export class GeminiCompletionAdapter implements AiCompletionPort {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string = aiModelsConfig.gemini) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: request.prompt,
    });

    return { text: response.text ?? "" };
  }
}
