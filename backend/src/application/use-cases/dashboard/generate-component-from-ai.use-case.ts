import type { CommandRegistry } from "../../../domain/commands/command-registry.js";
import { componentLabel } from "../../../domain/components/component-label.js";
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
  referencedComponentIds?: string[];
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

function explicitlyRequestsComponent(input: string): boolean {
  return /\b(componente|widget|panel|dashboard|tarjeta|grafica|gráfica|tabla|visualizaci[oó]n)\b/i.test(
    input,
  );
}

interface ExistingComponent {
  id: string;
  label: string | null;
  size: WidgetSizeName;
  childCount: number;
}

function buildExistingComponentsHint(existing: ExistingComponent[]): string {
  if (existing.length === 0) {
    return `---
This operation has no components yet, so every request that needs one uses create_component.`;
  }

  return `---
Existing components of this operation. "label" is the name the user sees on the widget, and it is what they will describe a component by:
${JSON.stringify(existing)}

Use update_component when the message points at exactly one of them — because it was referenced, or because it names that widget's current content or purpose closely enough to leave no doubt — passing its "id" as "componentId". When the request is new or generic, when it matches more than one, or when nothing here matches, use create_component: adding one component too many is safer than overwriting the wrong one.`;
}

function buildReferencedComponentsHint(referenced: Component[]): string {
  if (referenced.length === 0) {
    return "";
  }

  const readable = referenced.map(({ id, title, size, children }) => ({
    id,
    title,
    size,
    children,
  }));

  return `\n\n---
The user is pointing at these components of their dashboard, and this is their full content:
${JSON.stringify(readable)}

When the message is a question about them, answer it in plain text and call no tool. When it asks for a change to one of them, that is the component to update: pass its "id" as "componentId".`;
}

function buildSystemPrompt(
  template: string,
  trigger: AiTrigger,
  existingComponents: ExistingComponent[],
  referenced: Component[],
  context?: PromptContext,
): string {
  const base = buildBasePrompt(
    template,
    trigger,
    "The user's current message is supplied separately.",
    GRID_COLUMNS,
    context,
  );

  return `${base}\n\n${buildExistingComponentsHint(existingComponents)}${buildReferencedComponentsHint(referenced)}`;
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
    const requiresComponentTool = trigger === "chat" && explicitlyRequestsComponent(input);
    // save_company_context is a chat-only tool: a webhook has no user to
    // confirm what is worth remembering about the company.
    const tools = commandRegistry
      .list()
      .filter(
        (command) =>
          (trigger !== "chat" || command.name !== "ingest_company_concepts") &&
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
        forceTool: trigger !== "chat" || requiresComponentTool,
        ...(requiresComponentTool ? { requiredToolName: "create_component" } : {}),
      });

      if (result.kind === "text") {
        if (trigger === "chat") {
          eventPublisher?.publish(operationId, "component-pending-cleared", null);
          return { component: null, reply: result.text };
        }
        throw new InvalidAiComponentError(`no tool called: ${result.text}`);
      }

      try {
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

    const components = await componentRepository.findByOperationId(input.operationId);
    const existingComponents: ExistingComponent[] = components.map((component) => ({
      id: component.id,
      label: componentLabel(component),
      size: component.size,
      childCount: component.children.length,
    }));

    const referencedIds = new Set(input.referencedComponentIds ?? []);
    const referencedComponents = components.filter((component) => referencedIds.has(component.id));

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
      referencedComponents,
      promptContext,
    );

    const componentExpected = input.trigger === "auto" || explicitlyRequestsComponent(input.input);
    if (componentExpected && eventPublisher && idGenerator) {
      eventPublisher.publish(input.operationId, "component-pending", {
        operationId: input.operationId,
        tempId: idGenerator.newId(),
        estimatedSize: ESTIMATED_PENDING_SIZE,
      });
    }

    let result: { component: Component | null; reply: string };
    try {
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
    } catch (error) {
      if (!(error instanceof InvalidAiComponentError)) {
        if (componentExpected) {
          eventPublisher?.publish(input.operationId, "component-pending-cleared", null);
        }
        throw error;
      }
      // Resending the untouched message makes the model repeat the rejected
      // call and the user gets a bare 502. Some rejections are refusals the
      // model has to relay in words — the company's data is frozen — and it
      // can only do that if it is told what came back.
      try {
        result = await completeAndDispatch(
          systemPrompt,
          `${input.input}\n\n---\nYour previous tool call was rejected: ${error.message}\nDo not repeat it. Correct it if you can, or answer in plain text explaining what cannot be done.`,
          input.operationId,
          input.trigger,
        );
      } catch (retryError) {
        if (componentExpected) {
          eventPublisher?.publish(input.operationId, "component-pending-cleared", null);
        }
        throw retryError;
      }
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
