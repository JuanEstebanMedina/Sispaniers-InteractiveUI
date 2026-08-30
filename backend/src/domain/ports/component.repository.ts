import type { Component } from "../components/component.js";

export interface ComponentRepository {
  findByOperationId(operationId: string): Promise<Component[]>;
  findById(id: string): Promise<Component | null>;
  save(component: Component): Promise<void>;
  setField(id: string, path: string, value: unknown): Promise<void>;
  deleteById(id: string): Promise<void>;
}
