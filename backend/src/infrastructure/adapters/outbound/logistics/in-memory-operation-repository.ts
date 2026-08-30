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

export class InMemoryOperationRepository implements OperationRepository {
  private readonly operations = new Map<string, Operation>();

  async findById(id: string): Promise<Operation | null> {
    return this.operations.get(id) ?? null;
  }

  async findAll(filter: OperationQueryFilter = {}): Promise<Operation[]> {
    return [...this.operations.values()].filter((operation) => {
      if (filter.ids !== undefined && !filter.ids.includes(operation.id)) {
        return false;
      }
      if (filter.companyId !== undefined && !companyMatches(operation, filter.companyId)) {
        return false;
      }
      if (filter.health !== undefined && operation.health !== filter.health) {
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
