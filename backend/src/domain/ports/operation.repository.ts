import type { OperationHealth } from "../enums/operation-health.js";
import type { Operation } from "../logistics/operation.js";

export interface OperationQueryFilter {
  companyId?: string;
  health?: OperationHealth;
  /**
   * Texto libre, sin distinguir mayúsculas. Coincide contra el id de la
   * operación, los ids de sus empresas y los puertos de sus reservas — que es
   * lo que la persona tiene delante cuando escribe en el buscador.
   */
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface OperationRepository {
  findById(id: string): Promise<Operation | null>;
  findAll(filter?: OperationQueryFilter): Promise<Operation[]>;
  save(operation: Operation): Promise<void>;
}
