import { expect, test } from "vitest";
import { FallbackAiCompletionAdapter } from "../../src/infrastructure/adapters/outbound/fallback-ai-completion-adapter.js";

test("reports both provider failures", async () => {
  const adapter = new FallbackAiCompletionAdapter(
    { complete: async () => Promise.reject(new Error("OpenAI unavailable")) },
    { complete: async () => Promise.reject(new Error("Gemini key invalid")) },
  );

  await expect(adapter.complete({ prompt: "hello" })).rejects.toThrow(
    "primary: OpenAI unavailable; fallback: Gemini key invalid",
  );
});
