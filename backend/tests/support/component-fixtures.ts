import { randomUUID } from "node:crypto";
import type { Component } from "../../src/domain/components/component.js";
import type { WidgetSizeName } from "../../src/domain/components/widget-size.js";
import type { ComponentRepository } from "../../src/domain/ports/component.repository.js";

export function aComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: randomUUID(),
    operationId: randomUUID(),
    order: 0,
    kind: "container",
    children: [{ kind: "title", order: 0, props: { text: "Vessel ETA" } }],
    size: "small" satisfies WidgetSizeName,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export class InMemoryComponentRepository implements ComponentRepository {
  private readonly components = new Map<string, Component>();

  async findByOperationId(operationId: string): Promise<Component[]> {
    return [...this.components.values()].filter(
      (component) => component.operationId === operationId,
    );
  }

  async findById(id: string): Promise<Component | null> {
    return this.components.get(id) ?? null;
  }

  async save(component: Component): Promise<void> {
    this.components.set(component.id, component);
  }

  async setField(id: string, path: string, value: unknown): Promise<void> {
    const component = this.components.get(id);
    if (component === undefined) {
      return;
    }
    this.components.set(id, { ...component, [path]: value } as Component);
  }

  async deleteById(id: string): Promise<void> {
    this.components.delete(id);
  }
}
