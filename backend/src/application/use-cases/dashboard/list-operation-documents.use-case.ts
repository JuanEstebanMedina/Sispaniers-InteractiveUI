import type { Document } from "../../../domain/logistics/document.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface ListOperationDocumentsInput {
  operationId: string;
  /** When set, the operation is hidden (404) unless this company is a party to it. */
  requesterCompanyId?: string;
}

export interface ListOperationDocumentsResult {
  documents: Document[];
}

export interface ListOperationDocumentsDeps {
  operationRepository: OperationRepository;
}

// Same shape as get-operation's: a document list is part of the operation
// aggregate, so whoever cannot see the operation cannot see its documents
// either — 404, not an empty list, so a company scanning ids cannot tell an
// operation exists by getting zero documents back instead of a real 404.
function isAccessibleTo(operation: Operation, requesterCompanyId: string): boolean {
  return (
    operation.companyId === requesterCompanyId ||
    operation.bookings.some((booking) => booking.companyIds.includes(requesterCompanyId))
  );
}

export function createListOperationDocumentsUseCase(deps: ListOperationDocumentsDeps) {
  const { operationRepository } = deps;

  return async function listOperationDocuments(
    input: ListOperationDocumentsInput,
  ): Promise<ListOperationDocumentsResult> {
    const operation = await operationRepository.findById(input.operationId);

    if (
      operation === null ||
      (input.requesterCompanyId !== undefined &&
        !isAccessibleTo(operation, input.requesterCompanyId))
    ) {
      throw new OperationNotFoundError(input.operationId);
    }

    return { documents: operation.context.documents };
  };
}
