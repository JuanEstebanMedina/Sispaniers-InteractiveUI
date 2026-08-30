import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResult,
} from "../../../domain/ports/ai-completion-port.js";

export class FallbackAiCompletionAdapter implements AiCompletionPort {
  constructor(
    private readonly primary: AiCompletionPort,
    private readonly secondary: AiCompletionPort,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    try {
      return await this.primary.complete(request);
    } catch (error) {
      console.warn("Primary AI completion failed, falling back to secondary", error);
      return this.secondary.complete(request);
    }
  }
}
