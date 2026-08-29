import type { Operation } from "../model/operation.js";

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findActiveByClient(clientId: string): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
