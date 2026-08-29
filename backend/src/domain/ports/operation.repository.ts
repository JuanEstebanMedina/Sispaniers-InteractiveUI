import type { Operation } from "../logistics/operation.js";

export interface OperationRepository {
  findAll(): Promise<Operation[]>;
  findById(id: string): Promise<Operation | null>;
  findActiveByClient(clientId: string): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
