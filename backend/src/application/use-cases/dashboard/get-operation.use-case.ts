import type { ContainerState } from "../../../domain/enums/container-state.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface GetOperationInput {
  id: string;
  /** When set, the operation is hidden (404) unless this company is a party to it. */
  requesterCompanyId?: string;
}

export interface GetOperationResult {
  operation: Operation;
  status: ContainerState;
}

export interface GetOperationDeps {
  operationRepository: OperationRepository;
}

function isAccessibleTo(operation: Operation, requesterCompanyId: string): boolean {
  return (
    operation.companyId === requesterCompanyId ||
    operation.bookings.some((booking) => booking.companyIds.includes(requesterCompanyId))
  );
}

export function createGetOperationUseCase(deps: GetOperationDeps) {
  const { operationRepository } = deps;

  return async function getOperation(input: GetOperationInput): Promise<GetOperationResult> {
    const operation = await operationRepository.findById(input.id);

    if (
      operation === null ||
      (input.requesterCompanyId !== undefined &&
        !isAccessibleTo(operation, input.requesterCompanyId))
    ) {
      throw new OperationNotFoundError(input.id);
    }

    return { operation, status: deriveOperationStatus(operation) };
  };
}
