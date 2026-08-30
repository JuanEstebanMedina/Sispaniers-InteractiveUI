import type { OperationHealth } from "../enums/operation-health.js";
import type { Operation } from "../logistics/operation.js";

export interface OperationQueryFilter {
  ids?: string[];
  health?: OperationHealth;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findAll(filter?: OperationQueryFilter): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
