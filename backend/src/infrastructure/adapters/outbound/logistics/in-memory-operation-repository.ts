import { deriveOperationStatus } from "../../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../../domain/logistics/operation.js";
import type {
  OperationQueryFilter,
  OperationRepository,
} from "../../../../domain/ports/operation.repository.js";

const DELIVERED = "delivered";

export class InMemoryOperationRepository implements OperationRepository {
  private readonly operations = new Map<string, Operation>();

  async findById(id: string): Promise<Operation | null> {
    return this.operations.get(id) ?? null;
  }

  async findActiveByClient(clientId: string): Promise<Operation[]> {
    return [...this.operations.values()].filter(
      (operation) =>
        operation.clientId === clientId && deriveOperationStatus(operation) !== DELIVERED,
    );
  }

  async findAll(filter: OperationQueryFilter = {}): Promise<Operation[]> {
    return [...this.operations.values()].filter((operation) => {
      if (filter.health !== undefined && operation.health !== filter.health) {
        return false;
      }
      if (
        filter.clientIdContains !== undefined &&
        !operation.clientId.toLowerCase().includes(filter.clientIdContains.toLowerCase())
      ) {
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
