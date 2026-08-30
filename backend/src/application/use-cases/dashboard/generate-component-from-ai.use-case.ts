import type { CommandRegistry } from "../../../domain/commands/command-registry.js";
import type { Component } from "../../../domain/components/component.js";
import type { WidgetSizeName } from "../../../domain/components/widget-size.js";
import {
  InvalidAiComponentError,
  InvalidCommandInputError,
  InvalidComponentPathError,
  InvalidComponentTreeError,
  OperationNotFoundError,
  UnknownCommandError,
} from "../../../domain/model/errors.js";
import type { AiCompletionPort } from "../../../domain/ports/ai-completion-port.js";
import type { ChatHistoryPort } from "../../../domain/ports/chat-history.port.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type { ComponentEventPublisher } from "../../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { QueryCompanyConceptsCommandResult } from "../../commands/query-company-concepts.command.js";
import { type PromptContext, buildBasePrompt } from "./ai-response.helpers.js";

export type AiTrigger = "chat" | "auto";

export interface GenerateComponentFromAiInput {
  operationId: string;
  trigger: AiTrigger;
  input: string;
}

export interface GenerateComponentFromAiDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  companyRepository?: CompanyRepository;
  aiCompletionPort: AiCompletionPort;
  commandRegistry: CommandRegistry;
  promptTemplate: string;
  chatHistoryPort?: ChatHistoryPort;
  eventPublisher?: ComponentEventPublisher;
  idGenerator?: IdGenerator;
}

const ESTIMATED_PENDING_SIZE: WidgetSizeName = "small";
const GRID_COLUMNS = 4;
const MAX_QUERY_TOOL_CALLS = 3;
const CONTINUATION_COMMANDS = new Set(["ingest_company_concepts", "query_company_concepts"]);
const BUILDING_COMMANDS = new Set(["create_component", "update_component"]);

function buildExistingComponentsHint(
  trigger: AiTrigger,
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  if (trigger === "chat") {
    return `---
update_component is not available for chat messages. If a component is warranted, use create_component to add a new one; otherwise answer or ask for clarification without a tool.`;
  }

  return `---
Existing components on this operation (use update_component ONLY when a component is warranted and user's message explicitly mentions modifying/updating/replacing an EXISTING component, e.g. it names its current content or purpose, using its "id" as "componentId"; for a requested new view, use create_component):
${JSON.stringify(existingComponents)}`;
}

function buildSystemPrompt(
  template: string,
  trigger: AiTrigger,
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
  context?: PromptContext,
): string {
  const base = buildBasePrompt(
    template,
    trigger,
    "The user's current message is supplied separately.",
    GRID_COLUMNS,
    context,
  );
  return `${base}\n\n${buildExistingComponentsHint(trigger, existingComponents)}`;
}

export function createGenerateComponentFromAiUseCase(deps: GenerateComponentFromAiDeps) {
  const {
    operationRepository,
    componentRepository,
    companyRepository,
    aiCompletionPort,
    commandRegistry,
    promptTemplate,
    chatHistoryPort,
    eventPublisher,
    idGenerator,
  } = deps;

  async function completeAndDispatch(
    systemPrompt: string,
    input: string,
    operationId: string,
    trigger: AiTrigger,
  ): Promise<{ component: Component | null; reply: string }> {
    const tools = commandRegistry
      .list()
      .filter(
        (command) =>
          (trigger !== "chat" ||
            (command.name !== "update_component" && command.name !== "ingest_company_concepts")) &&
          (trigger !== "auto" || command.name !== "save_company_context"),
      )
      .map((command) => ({
        name: command.name,
        description: command.description,
        inputSchema: command.inputSchema,
      }));
    let queryCount = 0;
    let nextInput = input;

    while (true) {
      const result = await aiCompletionPort.complete({
        prompt: nextInput,
        systemPrompt,
        tools,
        forceTool: trigger !== "chat",
      });

      if (result.kind === "text") {
        if (trigger === "chat") {
          eventPublisher?.publish(operationId, "component-pending-cleared", null);
          return { component: null, reply: result.text };
        }
        throw new InvalidAiComponentError(`no tool called: ${result.text}`);
      }

      try {
        if (BUILDING_COMMANDS.has(result.toolName) && eventPublisher && idGenerator) {
          eventPublisher.publish(operationId, "component-pending", {
            operationId,
            tempId: idGenerator.newId(),
            estimatedSize: ESTIMATED_PENDING_SIZE,
          });
        }
        const dispatched = await commandRegistry.dispatch(result.toolName, result.input, {
          operationId,
        });
        if (result.toolName === "save_company_context") {
          return { component: null, reply: (dispatched as { reply: string }).reply };
        }
        if (!CONTINUATION_COMMANDS.has(result.toolName)) {
          return dispatched as { component: Component; reply: string };
        }
        if (queryCount >= MAX_QUERY_TOOL_CALLS) {
          throw new InvalidAiComponentError("too many company concept queries");
        }
        queryCount += 1;
        nextInput = `${nextInput}\n\n---\n${result.toolName} result:\n${JSON.stringify(
          dispatched as QueryCompanyConceptsCommandResult,
        )}\nUse this result now. Call another tool only when needed.`;
      } catch (error) {
        if (
          error instanceof UnknownCommandError ||
          error instanceof InvalidCommandInputError ||
          error instanceof InvalidComponentTreeError ||
          error instanceof InvalidComponentPathError
        ) {
          throw new InvalidAiComponentError(error.message);
        }
        throw error;
      }
    }
  }

  return async function generateComponentFromAi(
    input: GenerateComponentFromAiInput,
  ): Promise<{ component: Component | null; reply: string }> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) throw new OperationNotFoundError(input.operationId);

    const existingComponents = (await componentRepository.findByOperationId(input.operationId)).map(
      (component) => ({
        id: component.id,
        size: component.size,
        childCount: component.children.length,
      }),
    );
    const company =
      operation.companyId === undefined || companyRepository === undefined
        ? null
        : await companyRepository.findById(operation.companyId);
    const promptContext: PromptContext = {
      // The company's own id is an internal identifier, never the model's
      // answer to "what's the client called" — leading with the real name
      // here is what keeps it from guessing (or worse, inventing a
      // plausible-looking id) when asked who the operation is for.
      companyKnowledge: company ? [`Company name: ${company.name}`, ...company.generalContext] : [],
      clientMemory: [],
      runHistory:
        input.trigger === "chat" && chatHistoryPort !== undefined
          ? chatHistoryPort.get(input.operationId)
          : [],
      componentCatalog: [],
      operationContext: operation,
    };
    const systemPrompt = buildSystemPrompt(
      promptTemplate,
      input.trigger,
      existingComponents,
      promptContext,
    );

    let result: { component: Component | null; reply: string };
    try {
      result = await completeAndDispatch(
        systemPrompt,
        input.input,
        input.operationId,
        input.trigger,
      );
    } catch (error) {
      if (!(error instanceof InvalidAiComponentError)) throw error;
      result = await completeAndDispatch(
        systemPrompt,
        input.input,
        input.operationId,
        input.trigger,
      );
    }

    if (input.trigger === "chat" && chatHistoryPort !== undefined) {
      const recordedAt = new Date();
      chatHistoryPort.append(input.operationId, { role: "user", content: input.input, recordedAt });
      chatHistoryPort.append(input.operationId, {
        role: "assistant",
        content: result.reply,
        recordedAt,
      });
    }
    return result;
  };
}
