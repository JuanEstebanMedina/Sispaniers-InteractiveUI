import type { ContainerState } from "../../../domain/enums/container-state.js";
import type { OperationHealth } from "../../../domain/enums/operation-health.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { CompanyReferenceRequiredError } from "../../../domain/model/errors.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { ResolveCompany } from "../shared/resolve-company.use-case.js";

export interface CreateOperationInput {
  companyId?: string;
  company?: { name: string; contactEmails?: string[] };
  health?: OperationHealth;
}

export interface CreateOperationResult {
  operation: Operation;
  status: ContainerState;
}

export interface CreateOperationDeps {
  operationRepository: OperationRepository;
  resolveCompany: ResolveCompany;
  idGenerator: IdGenerator;
}

export function createCreateOperationUseCase(deps: CreateOperationDeps) {
  const { operationRepository, resolveCompany, idGenerator } = deps;

  return async function createOperation(
    input: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    const company = await resolveCompany({
      ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
      ...(input.company !== undefined
        ? {
            companyName: input.company.name,
            ...(input.company.contactEmails !== undefined
              ? { contactEmails: input.company.contactEmails }
              : {}),
          }
        : {}),
    });

    if (company === undefined) {
      throw new CompanyReferenceRequiredError();
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
