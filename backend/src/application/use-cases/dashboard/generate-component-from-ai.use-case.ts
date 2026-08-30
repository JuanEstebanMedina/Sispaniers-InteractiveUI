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

function buildExistingComponentsHint(
  trigger: AiTrigger,
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  if (trigger === "chat") {
    return `---
update_component is not available for chat messages. Use create_component: always add a new component, never modify an existing one.`;
  }

  return `---
Existing components on this operation (use update_component ONLY if the user's message explicitly mentions wanting to modify/update/replace an EXISTING component, e.g. it names its current content or purpose, using its "id" as "componentId"; for any new or generic request, always use create_component, even if other components already exist):
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
          (trigger !== "chat" || command.name !== "update_component") &&
          (trigger !== "auto" || command.name !== "save_company_context"),
      )
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
