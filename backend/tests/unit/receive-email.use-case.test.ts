import { expect, test } from "vitest";
import { createReceiveEmailUseCase } from "../../src/application/use-cases/email/receive-email.use-case.js";
import type { NormalizedEmail } from "../../src/domain/model/email.js";
import type { ExtractedContent } from "../../src/domain/model/extracted-content.js";
import type { AttachmentExtractor } from "../../src/domain/ports/attachment-extractor.port.js";

const email: NormalizedEmail = {
  source: "make",
  messageId: "msg-1",
  from: "bookings@mscmed.com",
  subject: "Booking Confirmation",
  receivedAt: "2026-08-29T14:30:00.000Z",
};

const noopExtractor: AttachmentExtractor = {
  extract: () => Promise.resolve({ format: "other" as const }),
};

test("returns a run id for the incoming email", async () => {
  const receiveEmail = createReceiveEmailUseCase({
    idGenerator: { newId: () => "id-1" },
    attachmentExtractor: noopExtractor,
  });

  const result = await receiveEmail(email);

  expect(result.runId).toBe("id-1");
  expect(result.attachments).toEqual([]);
});

test("generates a fresh run id for each call", async () => {
  let counter = 0;
  const receiveEmail = createReceiveEmailUseCase({
    idGenerator: { newId: () => `id-${++counter}` },
    attachmentExtractor: noopExtractor,
  });

  expect((await receiveEmail(email)).runId).toBe("id-1");
  expect((await receiveEmail(email)).runId).toBe("id-2");
});

test("extracts every attachment via the AttachmentExtractor port", async () => {
  const extracted: ExtractedContent = { format: "document", content: "hello" };
  const receiveEmail = createReceiveEmailUseCase({
    idGenerator: { newId: () => "id-1" },
    attachmentExtractor: { extract: () => Promise.resolve(extracted) },
  });

  const result = await receiveEmail({
    ...email,
    attachments: [{ filename: "a.docx", mimetype: "text/plain", data: "ZGF0YQ==" }],
  });

  expect(result.attachments).toEqual([extracted]);
});
