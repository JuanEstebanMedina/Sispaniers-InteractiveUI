import { AiCompletionError } from "../../../domain/model/errors.js";
import type { AiCompletionPort } from "../../../domain/ports/ai-completion-port.js";
import type { AiTrigger } from "./generate-component-from-ai.use-case.js";

const NOT_AVAILABLE = "N/A (no disponible en esta versión)";

export function buildBasePrompt(
  template: string,
  trigger: AiTrigger,
  currentInput: string,
  gridColumns: number,
): string {
  return template
    .replaceAll("{{company_knowledge}}", NOT_AVAILABLE)
    .replaceAll("{{client_memory}}", NOT_AVAILABLE)
    .replaceAll("{{trigger}}", trigger)
    .replaceAll("{{current_input}}", currentInput)
    .replaceAll("{{grid_columns}}", String(gridColumns));
}

export async function completeOrThrow(
  aiCompletionPort: AiCompletionPort,
  prompt: string,
): Promise<{ text: string }> {
  try {
    return await aiCompletionPort.complete({ prompt });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiCompletionError(reason);
  }
}

export function stripMarkdownCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? (match[1] ?? "") : text.trim();
}

export function truncateForDebugging(text: string): string {
  const MAX_LENGTH = 200;
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}...` : text;
}
