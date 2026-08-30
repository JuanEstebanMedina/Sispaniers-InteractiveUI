import { expect, test } from "vitest";
import { createUploadOperationDocumentUseCase } from "../../src/application/use-cases/dashboard/upload-operation-document.use-case.js";
import type { AttachmentExtractor } from "../../src/domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../src/domain/ports/attachment-storage.port.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { anOperation } from "../support/operation-fixtures.js";

const OPERATION_ID = "op-1";

function buildUseCase() {
  const operationRepository = new InMemoryOperationRepository();
  void operationRepository.save(anOperation({ id: OPERATION_ID }));

  const attachmentStorage: AttachmentStorage = {
    upload: async () => {},
    createSignedUrl: async (path) => `https://storage.test/${path}`,
  };

  const attachmentExtractor: AttachmentExtractor = {
    extract: async () => ({ format: "document", content: "hola" }),
  };

  return {
    operationRepository,
    uploadOperationDocument: createUploadOperationDocumentUseCase({
      operationRepository,
      attachmentStorage,
      attachmentExtractor,
      idGenerator: { newId: () => "doc-1" },
    }),
  };
}

function aRequest(overrides: Partial<{ type: "PO" | "Invoice" }> = {}) {
  return {
    operationId: OPERATION_ID,
    filename: "incapacidad.pdf",
    mimetype: "application/pdf",
    data: Buffer.from("hola").toString("base64"),
    ...overrides,
  };
}

test("a manual upload with no declared type is filed as Other, not as a purchase order", async () => {
  const { uploadOperationDocument } = buildUseCase();

  const { document } = await uploadOperationDocument(aRequest());

  // The regression this guards: every upload used to default to "PO" and show
  // up in the UI labelled "Purchase order" regardless of what the file
  // actually was — a medical leave slip, an ID, anything.
  expect(document.type).toBe("Other");
});

test("an explicit type is respected", async () => {
  const { uploadOperationDocument } = buildUseCase();

  const { document } = await uploadOperationDocument(aRequest({ type: "Invoice" }));

  expect(document.type).toBe("Invoice");
});

test("the uploaded document is appended to the operation with the honest type, not silently classified", async () => {
  const { operationRepository, uploadOperationDocument } = buildUseCase();

  const before = (await operationRepository.findById(OPERATION_ID))?.context.documents.length ?? 0;
  await uploadOperationDocument(aRequest());
  const after = await operationRepository.findById(OPERATION_ID);

  expect(after?.context.documents).toHaveLength(before + 1);
  expect(after?.context.documents.at(-1)?.type).toBe("Other");
});
