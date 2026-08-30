import { expect, test } from "vitest";
import { OpenAiCompletionAdapter } from "../../src/infrastructure/adapters/outbound/openai-completion-adapter.js";

test("does not send unsupported reasoning_effort to chat completions", async () => {
  let request: Record<string, unknown> | undefined;
  const adapter = new OpenAiCompletionAdapter("test-key");
  (adapter as unknown as { client: unknown }).client = {
    chat: {
      completions: {
        create: async (input: Record<string, unknown>) => {
          request = input;
          return { choices: [{ message: { content: "Hola" } }] };
        },
      },
    },
  };

  await adapter.complete({ prompt: "Hola" });

  expect(request).not.toHaveProperty("reasoning_effort");
});
