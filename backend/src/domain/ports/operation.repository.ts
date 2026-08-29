import type { OperationHealth } from "../enums/operation-health.js";
import type { Operation } from "../logistics/operation.js";

export interface OperationQueryFilter {
  health?: OperationHealth;
  clientIdContains?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findActiveByClient(clientId: string): Promise<Operation[]>;
  findAll(filter?: OperationQueryFilter): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
