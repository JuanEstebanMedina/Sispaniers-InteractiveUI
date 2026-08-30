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

test("never sends reasoning_effort", async () => {
  expect(await payloadFor("gpt-4o-mini")).not.toHaveProperty("reasoning_effort");
  expect(await payloadFor("gpt-5.6-terra")).not.toHaveProperty("reasoning_effort");
});
