import { expect, test } from "vitest";
import { createGenerateComponentFromAiUseCase } from "../../src/application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import { CommandRegistry } from "../../src/domain/commands/command-registry.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import {
  InvalidAiComponentError,
  InvalidComponentTreeError,
} from "../../src/domain/model/errors.js";
import type { AiCompletionPort } from "../../src/domain/ports/ai-completion-port.js";
import type { ComponentRepository } from "../../src/domain/ports/component.repository.js";
import type { OperationRepository } from "../../src/domain/ports/operation.repository.js";

const OPERATION_ID = "op-1";

function buildUseCase(
  aiCompletionPort: AiCompletionPort = {
    complete: async () => ({ kind: "tool_call", toolName: "create_component", input: {} }),
  },
) {
  const commandRegistry = new CommandRegistry();
  commandRegistry.register({
    name: "create_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      throw new InvalidComponentTreeError("unknown node kind: NotificationSent");
    },
  });

  const operationRepository: OperationRepository = {
    findById: async () => ({ id: OPERATION_ID }) as unknown as Operation,
    findAll: async () => [],
    save: async () => {},
  };

  const componentRepository: ComponentRepository = {
    findByOperationId: async () => [],
    findById: async () => null,
    save: async () => {},
    setField: async () => {},
    deleteById: async () => {},
  };

  return createGenerateComponentFromAiUseCase({
    operationRepository,
    componentRepository,
    aiCompletionPort,
    commandRegistry,
    promptTemplate: "{{trigger}} {{input}}",
  });
}

/**
 * The AI once produced a node kind the domain does not know about
 * (`NotificationSent`). That surfaced as a bare 500 on /chat because
 * InvalidComponentTreeError was not one of the errors the use case treats as
 * an invalid AI response — it must be, same as UnknownCommandError.
 */
test("an invalid component tree from a tool call is treated as an invalid AI response, not a raw 500", async () => {
  const generateComponentFromAi = buildUseCase();

  await expect(
    generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "hola" }),
  ).rejects.toThrow(InvalidAiComponentError);
});

test("chat does not offer update_component to the AI", async () => {
  const commandRegistry = new CommandRegistry();
  const execute = async () => ({ component: {}, reply: "creado" });
  commandRegistry.register({
    name: "create_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute,
  });
  commandRegistry.register({
    name: "update_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute,
  });

  let offeredTools: string[] = [];
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as unknown as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    componentRepository: {
      findByOperationId: async () => [],
      findById: async () => null,
      save: async () => {},
      setField: async () => {},
      deleteById: async () => {},
    },
    aiCompletionPort: {
      complete: async ({ tools }) => {
        offeredTools = (tools ?? []).map((tool) => tool.name);
        return { kind: "tool_call", toolName: "create_component", input: {} };
      },
    },
    commandRegistry,
    promptTemplate: "{{trigger}} {{input}}",
  });

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "crea uno" });

  expect(offeredTools).toEqual(["create_component"]);
});

test("chat includes prior conversation on later messages", async () => {
  const messages: Array<{ role: "user" | "assistant"; content: string; recordedAt: Date }> = [];
  const prompts: string[] = [];
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as unknown as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    componentRepository: {
      findByOperationId: async () => [],
      findById: async () => null,
      save: async () => {},
      setField: async () => {},
      deleteById: async () => {},
    },
    aiCompletionPort: {
      complete: async ({ systemPrompt }) => {
        prompts.push(systemPrompt ?? "");
        return { kind: "text", text: "Hola, ¿qué quieres revisar?" };
      },
    },
    commandRegistry: new CommandRegistry(),
    promptTemplate: "{{run_history}}\n{{current_input}}",
    chatHistoryPort: {
      append: (_operationId, message) => messages.push(message),
      get: () => messages,
    },
  });

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "Hola" });
  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "¿Qué dije?" });

  expect(prompts[1]).toContain("user: Hola");
});
