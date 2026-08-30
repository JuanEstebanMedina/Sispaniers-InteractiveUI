import type { ContainerState } from "../../../domain/enums/container-state.js";
import type { OperationHealth } from "../../../domain/enums/operation-health.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { CompanyNotFoundError } from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface CreateOperationInput {
  companyId: string;
  health?: OperationHealth;
}

export interface CreateOperationResult {
  operation: Operation;
  status: ContainerState;
}

export interface CreateOperationDeps {
  operationRepository: OperationRepository;
  companyRepository: CompanyRepository;
  idGenerator: IdGenerator;
}

export function createCreateOperationUseCase(deps: CreateOperationDeps) {
  const { operationRepository, companyRepository, idGenerator } = deps;

  return async function createOperation(
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    const company = await companyRepository.findById(input.companyId);

    if (company === null) {
      throw new CompanyNotFoundError(input.companyId);
    }

    const operation: Operation = {
      id: idGenerator.newId(),
      companyId: company.id,
      bookings: [],
      context: { emails: [], documents: [] },
      createdAt: new Date(),
      health: input.health ?? "ok",
    };

    await operationRepository.save(operation);

    return { operation, status: deriveOperationStatus(operation) };
  };
}
