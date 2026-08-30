import type { ChatMessage } from "../../../domain/model/chat-message.js";
import { AiCompletionError, InvalidAiComponentError } from "../../../domain/model/errors.js";
import type { Milestone } from "../../../domain/model/milestone.js";
import type { AiCompletionPort } from "../../../domain/ports/ai-completion-port.js";
import type { ChatHistoryPort } from "../../../domain/ports/chat-history.port.js";
import type { ClientMemoryPort } from "../../../domain/ports/client-memory.port.js";
import type { CompanyKnowledgePort } from "../../../domain/ports/company-knowledge.port.js";
import type { EpisodicMemoryPort } from "../../../domain/ports/episodic-memory.port.js";
import type { AiTrigger } from "./generate-component-from-ai.use-case.js";

const NOT_AVAILABLE = "N/A (not available in this version)";

export interface PromptContext {
  companyKnowledge: string[];
  clientMemory: string[];
  runHistory: ChatMessage[];
  componentCatalog: Milestone[];
}

const EMPTY_PROMPT_CONTEXT: PromptContext = {
  companyKnowledge: [],
  clientMemory: [],
  runHistory: [],
  componentCatalog: [],
};

function renderKnowledgeList(entries: string[]): string {
  return entries.length === 0 ? NOT_AVAILABLE : entries.join("\n");
}

function renderChatHistory(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return NOT_AVAILABLE;
  }
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

function renderMilestones(milestones: Milestone[]): string {
  if (milestones.length === 0) {
    return NOT_AVAILABLE;
  }
  return milestones
    .map((milestone) => `${milestone.type}: ${JSON.stringify(milestone.payload)}`)
    .join("\n");
}

export function buildBasePrompt(
  template: string,
  trigger: AiTrigger,
  currentInput: string,
  gridColumns: number,
  context: PromptContext = EMPTY_PROMPT_CONTEXT,
): string {
  const replacements: Record<string, string> = {
    "{{company_knowledge}}": renderKnowledgeList(context.companyKnowledge),
    "{{client_memory}}": renderKnowledgeList(context.clientMemory),
    "{{run_history}}": renderChatHistory(context.runHistory),
    "{{component_catalog}}": renderMilestones(context.componentCatalog),
    "{{trigger}}": trigger,
    "{{current_input}}": currentInput,
    "{{grid_columns}}": String(gridColumns),
  };
  const placeholderPattern =
    /\{\{(company_knowledge|client_memory|run_history|component_catalog|trigger|current_input|grid_columns)\}\}/g;
  return template.replace(
    placeholderPattern,
    (placeholder) => replacements[placeholder] ?? placeholder,
  );
}

export async function completeOrThrow(
  aiCompletionPort: AiCompletionPort,
  prompt: string,
): Promise<{ text: string }> {
  let result: Awaited<ReturnType<AiCompletionPort["complete"]>>;
  try {
    result = await aiCompletionPort.complete({ prompt });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiCompletionError(reason);
  }
  if (result.kind !== "text") {
    throw new AiCompletionError(`unexpected result kind "${result.kind}" from a no-tools request`);
  }
  return result;
}

export function stripMarkdownCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? (match[1] ?? "") : text.trim();
}

export function truncateForDebugging(text: string): string {
  const MAX_LENGTH = 200;
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}...` : text;
}

export interface PromptContextPorts {
  chatHistoryPort: ChatHistoryPort;
  companyKnowledgePort: CompanyKnowledgePort;
  clientMemoryPort: ClientMemoryPort;
  episodicMemoryPort: EpisodicMemoryPort;
}

export async function fetchPromptContext(
  ports: PromptContextPorts,
  operationId: string,
  companyId: string | undefined,
): Promise<PromptContext> {
  const { chatHistoryPort, companyKnowledgePort, clientMemoryPort, episodicMemoryPort } = ports;

  const runHistory = chatHistoryPort.get(operationId);
  const companyKnowledge =
    companyId === undefined ? [] : await companyKnowledgePort.query(companyId);
  const clientMemory = await clientMemoryPort.query(operationId);
  const componentCatalog = await episodicMemoryPort.findByOperationId(operationId);

  return { companyKnowledge, clientMemory, runHistory, componentCatalog };
}

export async function completeWithParseRetry<T>(
  aiCompletionPort: AiCompletionPort,
  prompt: string,
  parse: (rawText: string) => T,
  retryWarningLabel: string,
): Promise<T> {
  const response = await completeOrThrow(aiCompletionPort, prompt);

  try {
    return parse(response.text);
  } catch (error) {
    if (!(error instanceof InvalidAiComponentError)) {
      throw error;
    }
    console.warn(`${retryWarningLabel}: retrying after invalid AI response`);
    const retryResponse = await completeOrThrow(aiCompletionPort, prompt);
    return parse(retryResponse.text);
  }
}
