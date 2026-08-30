import { expect, test, vi } from "vitest";

let sentPayload: Record<string, unknown> = {};

const create = vi.fn(async (payload: Record<string, unknown>) => {
  sentPayload = payload;
  return { choices: [{ message: { content: "ok" } }] };
});

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

const { OpenAiCompletionAdapter } = await import(
  "../../src/infrastructure/adapters/outbound/openai-completion-adapter.js"
);

async function payloadFor(model: string): Promise<Record<string, unknown>> {
  await new OpenAiCompletionAdapter("key", model).complete({ prompt: "hello" });
  return sentPayload;
}

/**
 * gpt-4o rejects the whole request with a 400 when reasoning_effort is present,
 * so sending it unconditionally takes the chat down for every non-reasoning
 * model the deployment happens to be configured with.
 */
test("omits reasoning_effort for a model that does not support it", async () => {
  expect(await payloadFor("gpt-4o-mini")).not.toHaveProperty("reasoning_effort");
});

test("keeps reasoning_effort for a reasoning model", async () => {
  expect(await payloadFor("gpt-5.6-luna")).toHaveProperty("reasoning_effort", "none");
});
