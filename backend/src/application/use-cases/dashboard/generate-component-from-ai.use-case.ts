import type { CommandRegistry } from "../../../domain/commands/command-registry.js";
import type { Component } from "../../../domain/components/component.js";
import type { WidgetSizeName } from "../../../domain/components/widget-size.js";
import {
  InvalidAiComponentError,
  InvalidCommandInputError,
  OperationNotFoundError,
  UnknownCommandError,
} from "../../../domain/model/errors.js";
import type { AiCompletionPort } from "../../../domain/ports/ai-completion-port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

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
const NOT_AVAILABLE = "N/A (no disponible en esta versión)";

function buildExistingComponentsHint(
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  return `---
Componentes existentes de esta operación (usa su "id" en "supersedes" si tu salida reemplaza a uno; si no reemplazas nada, "supersedes": null):
${JSON.stringify(existingComponents)}`;
}

function buildPrompt(
  template: string,
  trigger: AiTrigger,
  currentInput: string,
  existingComponents: Array<{ id: string; size: WidgetSizeName; childCount: number }>,
): string {
  const base = template
    .replaceAll("{{company_knowledge}}", NOT_AVAILABLE)
    .replaceAll("{{client_memory}}", NOT_AVAILABLE)
    .replaceAll("{{trigger}}", trigger)
    .replaceAll("{{current_input}}", currentInput)
    .replaceAll("{{grid_columns}}", String(GRID_COLUMNS));

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

  async function completeAndDispatch(prompt: string, operationId: string): Promise<Component> {
    const tools = commandRegistry.list().map((command) => ({
      name: command.name,
      description: command.description,
      inputSchema: command.inputSchema,
    }));

    const result = await aiCompletionPort.complete({ prompt, tools });

    if (result.kind === "text") {
      throw new InvalidAiComponentError(`no tool called: ${result.text}`);
    }

    try {
      return (await commandRegistry.dispatch(result.toolName, result.input, {
        operationId,
      })) as Component;
    } catch (error) {
      if (error instanceof UnknownCommandError || error instanceof InvalidCommandInputError) {
        throw new InvalidAiComponentError(error.message);
      }
      throw error;
    }
  }

  return async function generateComponentFromAi(
    input: GenerateComponentFromAiInput,
  ): Promise<Component> {
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
      return await completeAndDispatch(prompt, input.operationId);
    } catch (error) {
      if (!(error instanceof InvalidAiComponentError)) {
        throw error;
      }
      console.warn("generateComponentFromAi: retrying after invalid AI response");
      return completeAndDispatch(prompt, input.operationId);
    }
  };
}
