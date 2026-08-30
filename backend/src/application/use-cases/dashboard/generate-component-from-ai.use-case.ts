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
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import { buildBasePrompt } from "./ai-response.helpers.js";

export type AiTrigger = "chat" | "auto";

export interface GenerateComponentFromAiInput {
  operationId: string;
  trigger: AiTrigger;
  input: string;
}

export interface GenerateComponentFromAiDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  aiCompletionPort: AiCompletionPort;
  commandRegistry: CommandRegistry;
  promptTemplate: string;
}

const GRID_COLUMNS = 4;

function buildExistingComponentsHint(
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  return `---
Componentes existentes de esta operación (usa su "id" como "componentId" al llamar a update_component si tu salida reemplaza a uno; si no reemplazas nada, llama a create_component):
${JSON.stringify(existingComponents)}`;
}

function buildPrompt(
  template: string,
  trigger: AiTrigger,
  currentInput: string,
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  const base = buildBasePrompt(template, trigger, currentInput, GRID_COLUMNS);

  return `${base}\n\n${buildExistingComponentsHint(existingComponents)}`;
}

export function createGenerateComponentFromAiUseCase(deps: GenerateComponentFromAiDeps) {
  const {
    operationRepository,
    componentRepository,
    aiCompletionPort,
    commandRegistry,
    promptTemplate,
  } = deps;

  async function completeAndDispatch(
    prompt: string,
    operationId: string,
    trigger: AiTrigger,
  ): Promise<{ component: Component | null; reply: string }> {
    const tools = commandRegistry.list().map((command) => ({
      name: command.name,
      description: command.description,
      inputSchema: command.inputSchema,
    }));

    const result = await aiCompletionPort.complete({ prompt, tools });

    if (result.kind === "text") {
      if (trigger === "chat") {
        console.log(
          `generateComponentFromAi: chat trigger returned plain text for operation ${operationId}`,
        );
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

    const prompt = buildPrompt(promptTemplate, input.trigger, input.input, existingComponents);

    try {
      return await completeAndDispatch(prompt, input.operationId, input.trigger);
    } catch (error) {
      if (!(error instanceof InvalidAiComponentError)) {
        throw error;
      }
      console.warn(
        `generateComponentFromAi: retrying after invalid AI response for operation ${input.operationId}: ${error.message}`,
      );
      return completeAndDispatch(prompt, input.operationId, input.trigger);
    }
  };
}
