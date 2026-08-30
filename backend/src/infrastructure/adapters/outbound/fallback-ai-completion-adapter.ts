import { AiCompletionError } from "../../../domain/model/errors.js";
import type {
  AiCompletionPort,
  AiCompletionRequest,
  AiCompletionResult,
} from "../../../domain/ports/ai-completion-port.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class FallbackAiCompletionAdapter implements AiCompletionPort {
  constructor(
    private readonly primary: AiCompletionPort,
    private readonly secondary: AiCompletionPort,
  ) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    try {
      return await this.primary.complete(request);
    } catch (primaryError) {
      console.warn("Primary AI completion failed, falling back to secondary", primaryError);
      try {
        return await this.secondary.complete(request);
      } catch (secondaryError) {
        console.error("Secondary AI completion also failed", secondaryError);
        throw new AiCompletionError(
          `primary: ${errorMessage(primaryError)}; fallback: ${errorMessage(secondaryError)}`,
        );
      }
    }
  }
}
