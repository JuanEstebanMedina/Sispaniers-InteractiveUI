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

/**
 * Por qué campo se ordena.
 *
 * `updatedAt` no es un campo del documento: es lo ÚLTIMO que le pasó a la
 * operación — el cambio de ETA más reciente, o su creación si nunca se movió.
 * Por eso el orden se aplica acá y no en Mongo: es un valor derivado, igual
 * que el status.
 */
export const OPERATION_SORT_FIELDS = ["updatedAt", "company", "id"] as const;
export type OperationSortField = (typeof OPERATION_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const DEFAULT_SORT_FIELD: OperationSortField = "updatedAt";
export const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

export interface ListOperationsInput {
  status?: ContainerState;
  health?: OperationHealth;
  companyId?: string;
  /** Texto libre sobre id, empresas y puertos. */
  search?: string;
  from?: Date;
  to?: Date;
  date?: Date;
  sortBy?: OperationSortField;
  sortDir?: SortDirection;
}

/** Lo último que le pasó a la operación, en milisegundos. */
function lastActivityOf(operation: Operation): number {
  const changes = operation.bookings.flatMap((booking) => booking.schedule.changes);

  return changes.reduce(
    (latest, change) => Math.max(latest, change.occurredAt.getTime()),
    operation.createdAt.getTime(),
  );
}

function firstCompanyOf(operation: Operation): string | undefined {
  return operation.bookings.flatMap((booking) => booking.companyIds)[0];
}

function compareBy(field: OperationSortField, a: Operation, b: Operation): number {
  if (field === "id") {
    return a.id.localeCompare(b.id);
  }
  if (field === "company") {
    return (firstCompanyOf(a) ?? "").localeCompare(firstCompanyOf(b) ?? "");
  }
  return lastActivityOf(a) - lastActivityOf(b);
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
    ...(input.search !== undefined ? { search: input.search } : {}),
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

    const results = operations
      .map((operation) => ({ operation, status: deriveOperationStatus(operation) }))
      .filter(({ status }) => input.status === undefined || status === input.status);

    // Sin orden explícito NO se devuelve el orden natural de Mongo: ese orden
    // no está definido y puede cambiar entre consultas, así que la lista
    // "bailaría" sola entre refrescos. Por defecto va lo mismo que pide la
    // pantalla principal: lo último que se movió, primero.
    const field = input.sortBy ?? DEFAULT_SORT_FIELD;
    const direction = (input.sortDir ?? DEFAULT_SORT_DIRECTION) === "asc" ? 1 : -1;

    return [...results].sort((a, b) => compareBy(field, a.operation, b.operation) * direction);
  };
}
