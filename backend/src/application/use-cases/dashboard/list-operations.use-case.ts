import type { ContainerState } from "../../../domain/enums/container-state.js";
import type { OperationHealth } from "../../../domain/enums/operation-health.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import {
  CompanyNotFoundError,
  InvalidFilterCombinationError,
} from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type {
  OperationQueryFilter,
  OperationRepository,
} from "../../../domain/ports/operation.repository.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface ListOperationsInput {
  status?: ContainerState;
  health?: OperationHealth;
  companyId?: string;
  from?: Date;
  to?: Date;
  date?: Date;
}

export interface ListOperationsResultItem {
  operation: Operation;
  status: ContainerState;
}

export interface ListOperationsDeps {
  operationRepository: OperationRepository;
  companyRepository: CompanyRepository;
}

function toQueryFilter(
  input: ListOperationsInput,
  ids: string[] | undefined,
): OperationQueryFilter {
  const [createdFrom, createdTo] =
    input.date !== undefined
      ? [input.date, new Date(input.date.getTime() + ONE_DAY_MS - 1)]
      : [input.from, input.to];

  return {
    ...(ids !== undefined ? { ids } : {}),
    ...(input.health !== undefined ? { health: input.health } : {}),
    ...(createdFrom !== undefined ? { createdFrom } : {}),
    ...(createdTo !== undefined ? { createdTo } : {}),
  };
}

export function createListOperationsUseCase(deps: ListOperationsDeps) {
  const { operationRepository, companyRepository } = deps;

  async function operationIdsOf(companyId: string): Promise<string[]> {
    const company = await companyRepository.findById(companyId);

    if (company === null) {
      throw new CompanyNotFoundError(companyId);
    }

    return company.operationIds;
  }

  return async function listOperations(
    input: ListOperationsInput,
  ): Promise<ListOperationsResultItem[]> {
    if (input.date !== undefined && (input.from !== undefined || input.to !== undefined)) {
      throw new InvalidFilterCombinationError("date cannot be combined with from/to");
    }

    const ids = input.companyId === undefined ? undefined : await operationIdsOf(input.companyId);
    const operations = await operationRepository.findAll(toQueryFilter(input, ids));

    return operations
      .map((operation) => ({ operation, status: deriveOperationStatus(operation) }))
      .filter(({ status }) => input.status === undefined || status === input.status);
  };
}
