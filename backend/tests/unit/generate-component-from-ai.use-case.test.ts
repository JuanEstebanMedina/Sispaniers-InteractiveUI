import { expect, test } from "vitest";
import { createGenerateComponentFromAiUseCase } from "../../src/application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import type { Component } from "../../src/domain/components/component.js";
import { ATOMIC_NODE_KINDS } from "../../src/domain/enums/widget-kind.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";
import { anOperation } from "../support/operation-fixtures.js";

const A_VALID_RESPONSE = JSON.stringify({
  children: [{ kind: "title", order: 0, props: { text: "ETA" } }],
  reply: "Here is the ETA.",
  layout: { cols: 2, rows: 2 },
  supersedes: null,
});

async function buildUseCase(responses: string[] = [A_VALID_RESPONSE]) {
  const operationRepository = new InMemoryOperationRepository();
  const componentRepository = new InMemoryComponentRepository();
  const operation = anOperation();
  await operationRepository.save(operation);

  const prompts: string[] = [];
  let call = 0;
  const created: Array<{ size: string }> = [];

  return {
    operation,
    prompts,
    created,
    componentRepository,
    generate: createGenerateComponentFromAiUseCase({
      operationRepository,
      componentRepository,
      aiCompletionPort: {
        complete: async ({ prompt }) => {
          prompts.push(prompt);
          const text = responses[Math.min(call, responses.length - 1)] ?? "";
          call += 1;
          return { text };
        },
      },
      createComponent: async (input) => {
        created.push({ size: input.size });
        return aComponent({ operationId: input.operationId, size: input.size }) as Component;
      },
      updateComponentContent: async () => aComponent() as Component,
      promptTemplate: "TEMPLATE",
    }),
  };
}

/**
 * The prompt used to carry a hand-written kind list. It offered "button-group",
 * which the validator has never accepted, and omitted "layout", the only kind
 * that may carry children — so the agent was steered straight into a 400.
 */
test("the prompt offers the agent every kind the validator accepts", async () => {
  const { operation, prompts, generate } = await buildUseCase();

  await generate({ operationId: operation.id, trigger: "chat", input: "status" });

  for (const kind of ATOMIC_NODE_KINDS) {
    expect(prompts[0], `the prompt must offer "${kind}"`).toContain(`"${kind}"`);
  }
});

test("the prompt never offers a kind the validator rejects", async () => {
  const { operation, prompts, generate } = await buildUseCase();

  await generate({ operationId: operation.id, trigger: "chat", input: "status" });

  expect(prompts[0]).not.toContain("button-group");
});

test("a size the agent names by hand is the size that gets created", async () => {
  const { operation, created, generate } = await buildUseCase([
    JSON.stringify({
      children: [{ kind: "title", order: 0, props: { text: "ETA" } }],
      reply: "Here is the ETA.",
      size: "banner",
      layout: { cols: 2, rows: 2 },
      supersedes: null,
    }),
  ]);

  await generate({ operationId: operation.id, trigger: "chat", input: "status" });

  expect(created[0]?.size).toBe("banner");
});

test("without a named size the grid dimensions still pick the nearest one", async () => {
  const { operation, created, generate } = await buildUseCase();

  await generate({ operationId: operation.id, trigger: "chat", input: "status" });

  expect(created[0]?.size).toBe("small");
});

test("an invented size name falls back to the grid dimensions", async () => {
  const { operation, created, generate } = await buildUseCase([
    JSON.stringify({
      children: [{ kind: "title", order: 0, props: { text: "ETA" } }],
      reply: "Here is the ETA.",
      size: "gigantic",
      layout: { cols: 4, rows: 1 },
      supersedes: null,
    }),
  ]);

  await generate({ operationId: operation.id, trigger: "chat", input: "status" });

  expect(created[0]?.size).toBe("banner");
});
