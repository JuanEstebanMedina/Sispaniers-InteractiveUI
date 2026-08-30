import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { createListOperationDocumentsUseCase } from "../../src/application/use-cases/dashboard/list-operation-documents.use-case.js";
import { OperationNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { anOperation } from "../support/operation-fixtures.js";

function buildUseCase(operation = anOperation()) {
  const operationRepository = new InMemoryOperationRepository();
  void operationRepository.save(operation);

  return {
    operation,
    listOperationDocuments: createListOperationDocumentsUseCase({ operationRepository }),
  };
}

test("returns exactly the operation's documents, in their stored order", async () => {
  const { operation, listOperationDocuments } = buildUseCase();

  const result = await listOperationDocuments({ operationId: operation.id });

  expect(result).toEqual({ documents: operation.context.documents });
});

test("an operation with no documents returns an empty list, not an error", async () => {
  const { operation, listOperationDocuments } = buildUseCase(
    anOperation({ context: { emails: [], documents: [] } }),
  );

  await expect(listOperationDocuments({ operationId: operation.id })).resolves.toEqual({
    documents: [],
  });
});

test("an unknown id is a not-found error, never an empty list", async () => {
  const { listOperationDocuments } = buildUseCase();

  await expect(listOperationDocuments({ operationId: "missing" })).rejects.toThrow(
    OperationNotFoundError,
  );
});

test("a company that is a party to the operation via its bookings can list its documents", async () => {
  const companyId = randomUUID();
  const base = anOperation();
  const operation = anOperation({
    bookings: base.bookings.map((booking, index) =>
      index === 0 ? { ...booking, companyIds: [companyId] } : booking,
    ),
  });
  const { listOperationDocuments } = buildUseCase(operation);

  await expect(
    listOperationDocuments({ operationId: operation.id, requesterCompanyId: companyId }),
  ).resolves.toEqual({ documents: operation.context.documents });
});

// Same shape as get-operation: a document list is part of the operation
// aggregate, so an unrelated company gets the same 404 it would get asking for
// the operation itself — never a real 404 for the operation but an empty
// document list, which would leak that the operation exists.
test("an unrelated company gets a not-found error, not an empty list", async () => {
  const operation = anOperation();
  const { listOperationDocuments } = buildUseCase(operation);

  await expect(
    listOperationDocuments({ operationId: operation.id, requesterCompanyId: randomUUID() }),
  ).rejects.toThrow(OperationNotFoundError);
});
