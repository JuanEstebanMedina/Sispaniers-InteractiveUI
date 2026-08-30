import { expect, test } from "vitest";
import { createGenerateComponentFromAiUseCase } from "../../src/application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import { CommandRegistry } from "../../src/domain/commands/command-registry.js";
import type { Component } from "../../src/domain/components/component.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import {
  InvalidAiComponentError,
  InvalidComponentTreeError,
} from "../../src/domain/model/errors.js";
import type { AiCompletionPort } from "../../src/domain/ports/ai-completion-port.js";
import type { AiCompletionResult } from "../../src/domain/ports/ai-completion-port.js";
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

/**
 * The retry used to resend the original message untouched, so a model that had
 * just been told the company's figures are frozen would try the same edit
 * again and the user got a bare 502. Telling it what the domain rejected lets
 * it answer in words instead.
 */
test("the retry tells the model why the first attempt was rejected", async () => {
  const prompts: string[] = [];
  let calls = 0;
  const generateComponentFromAi = buildUseCase({
    complete: async ({ prompt }) => {
      prompts.push(prompt);
      calls += 1;
      return calls === 1
        ? { kind: "tool_call", toolName: "create_component", input: {} }
        : { kind: "text", text: "Esa cifra viene de los registros de la empresa." };
    },
  });

  const result = await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "cambia el 42 por 50",
  });

  expect(prompts[1]).toContain("unknown node kind: NotificationSent");
  expect(result.reply).toBe("Esa cifra viene de los registros de la empresa.");
});

/**
 * The chat used to be create-only, which made "change the ETA on that panel"
 * answerable only by building a second panel next to the first.
 */
test("chat offers update_component to the AI", async () => {
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

  expect(offeredTools).toEqual(["create_component", "update_component"]);
});

/**
 * Finding the component from a description is the whole point: `id`, `size` and
 * `childCount` name nothing a user would ever type.
 */
test("chat carries the existing components under a name the user could type", async () => {
  const capture = { systemPrompt: "" };
  const chart = componentStub({
    id: "cmp-chart",
    children: [{ kind: "title", order: 0, props: { text: "Costos por aduana" } }] as never,
  });
  const generateComponentFromAi = buildReferencingUseCase([chart], capture);

  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "cambia el de costos",
  });

  expect(capture.systemPrompt).toContain("Costos por aduana");
  expect(capture.systemPrompt).toContain("cmp-chart");
});

test("chat carries each component's size and packed position", async () => {
  const capture = { systemPrompt: "" };
  const first = componentStub({ id: "cmp-first", order: 0, size: "small" });
  const second = componentStub({ id: "cmp-second", order: 1, size: "wide" });
  const generateComponentFromAi = buildReferencingUseCase([first, second], capture);

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "ordénalos" });

  expect(capture.systemPrompt).toContain(
    '"id":"cmp-first","label":null,"size":"small","position":0,"col":0,"row":0,"w":2,"h":2',
  );
  expect(capture.systemPrompt).toContain(
    '"id":"cmp-second","label":null,"size":"wide","position":1,"col":0,"row":2,"w":4,"h":2',
  );
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
  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "¿Qué dije?",
  });

  expect(prompts[1]).toContain("user: Hola");
});

test("chat includes durable company knowledge", async () => {
  let systemPrompt = "";
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID, companyId: "company-1" }) as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    companyRepository: {
      findById: async () => ({
        id: "company-1",
        name: "Acme",
        contactEmails: [],
        preferredNotificationChannel: "email",
        generalContext: ["Salida semanal desde Cartagena."],
        active: true,
      }),
      findByName: async () => null,
      findByContactEmail: async () => null,
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
      complete: async ({ systemPrompt: prompt }) => {
        systemPrompt = prompt ?? "";
        return { kind: "text", text: "Entendido." };
      },
    },
    commandRegistry: new CommandRegistry(),
    promptTemplate: "{{company_knowledge}}",
  });

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "Hola" });

  expect(systemPrompt).toContain("Salida semanal desde Cartagena.");
});

test("chat includes operation emails and extracted document data", async () => {
  let systemPrompt = "";
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () =>
        ({
          id: OPERATION_ID,
          bookings: [],
          context: {
            emails: [{ from: "carrier@example.com", subject: "ETA updated" }],
            documents: [{ id: "doc-1", extractedData: { container: "ABC123" } }],
          },
          createdAt: new Date("2026-08-30T00:00:00.000Z"),
        }) as unknown as Operation,
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
      complete: async ({ systemPrompt: prompt }) => {
        systemPrompt = prompt ?? "";
        return { kind: "text", text: "ETA actualizado." };
      },
    },
    commandRegistry: new CommandRegistry(),
    promptTemplate: "{{operation_context}}",
  });

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "¿Hay ETA?" });

  expect(systemPrompt).toContain("ETA updated");
  expect(systemPrompt).toContain("ABC123");
});

test("chat text reply does not publish a component placeholder", async () => {
  const events: string[] = [];
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as Operation,
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
    aiCompletionPort: { complete: async () => ({ kind: "text", text: "¿Qué dato necesitas?" }) },
    commandRegistry: new CommandRegistry(),
    promptTemplate: "{{trigger}}",
    eventPublisher: {
      publish: (_operationId, event) => events.push(event),
      subscribe: () => () => {},
    },
    idGenerator: { newId: () => "pending-1" },
  });

  await generateComponentFromAi({ operationId: OPERATION_ID, trigger: "chat", input: "Hola" });

  expect(events).toEqual(["component-pending-cleared"]);
});

test("chat publishes a component placeholder before AI starts an explicit component request", async () => {
  const events: string[] = [];
  let eventsWhenAiStarts: string[] = [];
  const commandRegistry = new CommandRegistry();
  commandRegistry.register({
    name: "create_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({ component: { id: "component-1" }, reply: "Creado." }),
  });
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as Operation,
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
      complete: async () => {
        eventsWhenAiStarts = [...events];
        return { kind: "tool_call", toolName: "create_component", input: {} };
      },
    },
    commandRegistry,
    promptTemplate: "{{trigger}}",
    eventPublisher: {
      publish: (_operationId, event) => events.push(event),
      subscribe: () => () => {},
    },
    idGenerator: { newId: () => "pending-1" },
  });

  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "Crea un panel",
  });

  expect(events).toEqual(["component-pending"]);
  expect(eventsWhenAiStarts).toEqual(["component-pending"]);
});

test("an explicit component request requires an AI tool call", async () => {
  let forceTool = false;
  let requiredToolName: string | undefined;
  const commandRegistry = new CommandRegistry();
  commandRegistry.register({
    name: "create_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({ component: { id: "component-1" }, reply: "Creado." }),
  });
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as Operation,
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
      complete: async (request) => {
        forceTool = request.forceTool ?? false;
        requiredToolName = request.requiredToolName;
        return { kind: "tool_call", toolName: "create_component", input: {} };
      },
    },
    commandRegistry,
    promptTemplate: "{{trigger}}",
  });

  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "Crea un componente con estado de contenedores",
  });

  expect(forceTool).toBe(true);
  expect(requiredToolName).toBe("create_component");
});

test("auto flow can ingest, query, then create a component", async () => {
  const commandRegistry = new CommandRegistry();
  commandRegistry.register({
    name: "ingest_company_concepts",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({ definitions: 1, observations: 1 }),
  });
  commandRegistry.register({
    name: "query_company_concepts",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({
      concepts: [{ id: "monthly-volume", name: "Monthly volume", values: [] }],
    }),
  });
  commandRegistry.register({
    name: "create_component",
    description: "stub",
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({ component: { id: "component-1" }, reply: "Created." }),
  });
  const responses: AiCompletionResult[] = [
    { kind: "tool_call", toolName: "ingest_company_concepts", input: {} },
    { kind: "tool_call", toolName: "query_company_concepts", input: {} },
    { kind: "tool_call", toolName: "create_component", input: {} },
  ];
  const prompts: string[] = [];
  const generateComponentFromAi = createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as Operation,
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
      complete: async ({ prompt }) => {
        prompts.push(prompt);
        return responses.shift() ?? { kind: "text", text: "unexpected" };
      },
    },
    commandRegistry,
    promptTemplate: "{{trigger}}",
  });

  await expect(
    generateComponentFromAi({ operationId: OPERATION_ID, trigger: "auto", input: "email" }),
  ).resolves.toEqual({ component: { id: "component-1" }, reply: "Created." });
  expect(prompts).toHaveLength(3);
  expect(prompts[2]).toContain("query_company_concepts result");
});

test("chat can query company concepts before answering without creating a component", async () => {
  const prompts: string[] = [];
  const commandRegistry = new CommandRegistry();
  commandRegistry.register({
    name: "query_company_concepts",
    description: "stub",
    inputSchema: {
      type: "object",
      properties: { conceptIds: { type: "array", items: { type: "string" } } },
      required: ["conceptIds"],
    },
    execute: async () => ({
      concepts: [
        {
          id: "monthly-volume",
          name: "Volumen mensual",
          values: [{ observedAt: "2026-08-01T00:00:00.000Z", containers: 42 }],
        },
      ],
    }),
  });
  let calls = 0;
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
      complete: async ({ prompt }) => {
        prompts.push(prompt);
        calls += 1;
        return calls === 1
          ? {
              kind: "tool_call" as const,
              toolName: "query_company_concepts",
              input: { conceptIds: ["monthly-volume"] },
            }
          : { kind: "text" as const, text: "Volumen mensual registrado: 42 contenedores." };
      },
    },
    commandRegistry,
    promptTemplate: "{{trigger}}",
  });

  const result = await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "¿Cuál fue volumen mensual?",
  });

  expect(result).toEqual({
    component: null,
    reply: "Volumen mensual registrado: 42 contenedores.",
  });
  expect(prompts[1]).toContain('"containers":42');
});

function componentStub(overrides: Partial<Component>): Component {
  return {
    id: "cmp-1",
    operationId: OPERATION_ID,
    order: 0,
    size: "small",
    kind: "container",
    children: [],
    createdAt: new Date(0),
    ...overrides,
  };
}

function buildReferencingUseCase(stored: Component[], capture: { systemPrompt: string }) {
  return createGenerateComponentFromAiUseCase({
    operationRepository: {
      findById: async () => ({ id: OPERATION_ID }) as unknown as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    componentRepository: {
      findByOperationId: async (operationId) =>
        stored.filter((component) => component.operationId === operationId),
      findById: async (id) => stored.find((component) => component.id === id) ?? null,
      save: async () => {},
      setField: async () => {},
      deleteById: async () => {},
    },
    aiCompletionPort: {
      complete: async ({ systemPrompt }) => {
        capture.systemPrompt = systemPrompt ?? "";
        return { kind: "text", text: "Es el total de envíos por mes." };
      },
    },
    commandRegistry: new CommandRegistry(),
    promptTemplate: "{{trigger}}",
  });
}

/**
 * Asking "no entendí esta gráfica" is unanswerable from the id/size/childCount
 * summary the prompt already carried — the model needs to read what the widget
 * actually says.
 */
test("a referenced component reaches the prompt with its full content", async () => {
  const capture = { systemPrompt: "" };
  const chart = componentStub({
    id: "cmp-chart",
    children: [{ kind: "title", order: 0, props: { text: "Envíos por mes" } }] as never,
  });
  const generateComponentFromAi = buildReferencingUseCase([chart], capture);

  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "no entendí esta gráfica",
    referencedComponentIds: ["cmp-chart"],
  });

  expect(capture.systemPrompt).toContain("Envíos por mes");
});

/**
 * The referenced ids are the first client-supplied input that decides what gets
 * read into the prompt. An id from another operation would leak that
 * operation's content back through the reply.
 */
test("a referenced id outside the operation never reaches the prompt", async () => {
  const capture = { systemPrompt: "" };
  const foreign = componentStub({
    id: "cmp-foreign",
    operationId: "op-other",
    children: [{ kind: "title", order: 0, props: { text: "Carga confidencial" } }] as never,
  });
  const generateComponentFromAi = buildReferencingUseCase([foreign], capture);

  await generateComponentFromAi({
    operationId: OPERATION_ID,
    trigger: "chat",
    input: "no entendí esta gráfica",
    referencedComponentIds: ["cmp-foreign"],
  });

  expect(capture.systemPrompt).not.toContain("Carga confidencial");
  expect(capture.systemPrompt).not.toContain("cmp-foreign");
});
