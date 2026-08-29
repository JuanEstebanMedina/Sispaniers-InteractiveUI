import type { ContainerState } from "../../../domain/enums/container-state.js";
import type { OperationHealth } from "../../../domain/enums/operation-health.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface CreateOperationInput {
  clientId: string;
  health?: OperationHealth;
}

export interface CreateOperationResult {
  operation: Operation;
  status: ContainerState;
}

export interface CreateOperationDeps {
  operationRepository: OperationRepository;
  idGenerator: IdGenerator;
}

export function createCreateOperationUseCase(deps: CreateOperationDeps) {
  const { operationRepository, idGenerator } = deps;

  return async function createOperation(
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    const operation: Operation = {
      id: idGenerator.newId(),
      clientId: input.clientId,
      bookings: [],
      documents: [],
      createdAt: new Date(),
      health: input.health ?? "ok",
    };

    await operationRepository.save(operation);

    return { operation, status: deriveOperationStatus(operation) };
  };
}
