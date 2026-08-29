import type { Component } from "../components/component.js";

export interface ComponentRepository {
  findByOperationId(operationId: string): Promise<Component[]>;
  save(component: Component): Promise<void>;
}
