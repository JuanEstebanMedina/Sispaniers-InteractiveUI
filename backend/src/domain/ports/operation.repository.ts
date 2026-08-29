import type { Operation } from "../logistics/operation.js";

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findActiveByClient(clientId: string): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
