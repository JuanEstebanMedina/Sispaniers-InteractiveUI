import type { ContainerState } from "../../../domain/enums/container-state.js";
import type { OperationHealth } from "../../../domain/enums/operation-health.js";
import { deriveOperationStatus } from "../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { InvalidFilterCombinationError } from "../../../domain/model/errors.js";
import type {
  OperationQueryFilter,
  OperationRepository,
} from "../../../domain/ports/operation.repository.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface ListOperationsInput {
  status?: ContainerState;
  health?: OperationHealth;
  search?: string;
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
}

function toQueryFilter(input: ListOperationsInput): OperationQueryFilter {
  const [createdFrom, createdTo] =
    input.date !== undefined
      ? [input.date, new Date(input.date.getTime() + ONE_DAY_MS - 1)]
      : [input.from, input.to];

  return {
    ...(input.health !== undefined ? { health: input.health } : {}),
    ...(input.search !== undefined ? { clientIdContains: input.search } : {}),
    ...(createdFrom !== undefined ? { createdFrom } : {}),
    ...(createdTo !== undefined ? { createdTo } : {}),
  };
}

export function createListOperationsUseCase(deps: ListOperationsDeps) {
  const { operationRepository } = deps;

  return async function listOperations(
    input: ListOperationsInput,
  ): Promise<ListOperationsResultItem[]> {
    if (input.date !== undefined && (input.from !== undefined || input.to !== undefined)) {
      throw new InvalidFilterCombinationError("date cannot be combined with from/to");
    }

    const operations = await operationRepository.findAll(toQueryFilter(input));

    return operations
      .map((operation) => ({ operation, status: deriveOperationStatus(operation) }))
      .filter(({ status }) => input.status === undefined || status === input.status);
  };
}
