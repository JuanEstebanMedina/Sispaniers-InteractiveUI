import type { Operation } from "../../../../domain/logistics/operation.js";
import type {
  OperationQueryFilter,
  OperationRepository,
} from "../../../../domain/ports/operation.repository.js";

function companyMatches(operation: Operation, companyId: string): boolean {
  return (
    operation.companyId === companyId ||
    operation.bookings.some((booking) => booking.companyIds.includes(companyId))
  );
}

function matchesSearch(operation: Operation, search: string): boolean {
  const needle = search.toLowerCase();
  // Una operación se relaciona con empresas por dos vías: la dueña y las partes
  // de cada reserva. Las dos entran acá, igual que en `companyMatches`.
  const haystack = [
    operation.id,
    ...(operation.companyId !== undefined ? [operation.companyId] : []),
    ...operation.bookings.flatMap((booking) => [
      ...booking.companyIds,
      booking.originPort,
      booking.destinationPort,
    ]),
  ];

  return haystack.some((value) => value.toLowerCase().includes(needle));
}

export class InMemoryOperationRepository implements OperationRepository {
  private readonly operations = new Map<string, Operation>();

  async findById(id: string): Promise<Operation | null> {
    return this.operations.get(id) ?? null;
  }

  async findAll(filter: OperationQueryFilter = {}): Promise<Operation[]> {
    return [...this.operations.values()].filter((operation) => {
      if (filter.companyId !== undefined && !companyMatches(operation, filter.companyId)) {
        return false;
      }
      if (filter.health !== undefined && operation.health !== filter.health) {
        return false;
      }
      if (filter.search !== undefined && !matchesSearch(operation, filter.search)) {
        return false;
      }
      if (
        filter.createdFrom !== undefined &&
        operation.createdAt.getTime() < filter.createdFrom.getTime()
      ) {
        return false;
      }
      if (
        filter.createdTo !== undefined &&
        operation.createdAt.getTime() > filter.createdTo.getTime()
      ) {
        return false;
      }
      return true;
    });
  }

  async save(operation: Operation): Promise<void> {
    this.operations.set(operation.id, operation);
  }
}
