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
  // Optional so existing callers (and the unit test that builds this use
  // case without an event publisher) keep compiling. Production wiring in
  // composition.ts always supplies both.
  eventPublisher?: ComponentEventPublisher;
  idGenerator?: IdGenerator;
}

// ponytail: at the point the AI request starts we know nothing about what it
// will build — the actual size only exists inside `result.input` after the
// round trip completes, which is also the point most of the latency this
// placeholder exists to cover has already elapsed. A generic mid-size
// estimate fired before the AI call is the honest trade-off: it covers the
// full wait instead of a fraction of it.
const ESTIMATED_PENDING_SIZE: WidgetSizeName = "small";

const GRID_COLUMNS = 4;

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
    // save_company_context is a chat-only tool: a webhook has no user to
    // confirm what is worth remembering about the company.
    const tools = commandRegistry
      .list()
      .filter((command) => trigger !== "auto" || command.name !== "save_company_context")
      .map((command) => ({
        name: command.name,
        description: command.description,
        inputSchema: command.inputSchema,
      }));

    // "auto" always has to produce a component — nobody is reading a text
    // reply from a webhook. "chat" may legitimately have nothing to show
    // (the user asked for data the operation doesn't have), and forcing a
    // tool call there just makes the model build an empty component to hang
    // its answer on instead of saying so.
    const result = await aiCompletionPort.complete({
      prompt: input,
      systemPrompt,
      tools,
      forceTool: trigger !== "chat",
    });

    if (result.kind === "text") {
      if (trigger === "chat") {
        console.log(
          `generateComponentFromAi: chat trigger returned plain text for operation ${operationId}`,
        );
        // No component is coming for this turn, so the placeholder from
        // "component-pending" has nothing left to clear it — without this it
        // sits on screen looking like a stuck blank widget until its timeout.
        eventPublisher?.publish(operationId, "component-pending-cleared", null);
        return { component: null, reply: result.text };
      }
      console.warn(
        `generateComponentFromAi: auto trigger returned plain text instead of a tool call for operation ${operationId}, retrying`,
      );
      throw new InvalidAiComponentError(`no tool called: ${result.text}`);
    }

    console.log(
      `generateComponentFromAi: dispatching tool "${result.toolName}" for operation ${operationId}`,
    );

    try {
      const dispatched = (await commandRegistry.dispatch(result.toolName, result.input, {
        operationId,
      })) as { component: Component; reply: string };
      console.log(
        `generateComponentFromAi: tool "${result.toolName}" dispatched successfully for operation ${operationId}`,
      );
      return dispatched;
    } catch (error) {
      if (
        error instanceof UnknownCommandError ||
        error instanceof InvalidCommandInputError ||
        error instanceof InvalidComponentTreeError ||
        error instanceof InvalidComponentPathError
      ) {
        console.warn(
          `generateComponentFromAi: tool "${result.toolName}" dispatch failed for operation ${operationId}: ${error.message}`,
        );
        throw new InvalidAiComponentError(error.message);
      }
      throw error;
    }
  }

  return async function generateComponentFromAi(
    input: GenerateComponentFromAiInput,
  ): Promise<{ component: Component | null; reply: string }> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

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
    const promptContext = {
      companyKnowledge: company?.generalContext ?? [],
      clientMemory: [],
      runHistory:
        input.trigger === "chat" && chatHistoryPort !== undefined
          ? chatHistoryPort.get(input.operationId)
          : [],
      componentCatalog: [],
    };
    const prompt = buildSystemPrompt(
      promptTemplate,
      input.trigger,
      existingComponents,
      referencedComponents,
      promptContext,
    );

    if (eventPublisher && idGenerator) {
      eventPublisher.publish(input.operationId, "component-pending", {
        operationId: input.operationId,
        tempId: idGenerator.newId(),
        estimatedSize: ESTIMATED_PENDING_SIZE,
      });
    }

    let result: { component: Component | null; reply: string };
    try {
      result = await completeAndDispatch(prompt, input.input, input.operationId, input.trigger);
    } catch (error) {
      if (!(error instanceof InvalidAiComponentError)) {
        throw error;
      }
      console.warn(
        `generateComponentFromAi: retrying after invalid AI response for operation ${input.operationId}: ${error.message}`,
      );
      result = await completeAndDispatch(prompt, input.input, input.operationId, input.trigger);
    }

    if (input.trigger === "chat" && chatHistoryPort !== undefined) {
      const recordedAt = new Date();
      chatHistoryPort.append(input.operationId, {
        role: "user",
        content: input.input,
        recordedAt,
      });
      chatHistoryPort.append(input.operationId, {
        role: "assistant",
        content: result.reply,
        recordedAt,
      });
    }

    return result;
  };
}
