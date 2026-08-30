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

  // Mirrors Mongo's dotted-path `$set`: the real adapter walks into the tree,
  // so a fake that writes a literal "children.1.props.body" key would let a
  // narrow edit look stored while the component never changed.
  async setField(id: string, path: string, value: unknown): Promise<void> {
    const component = this.components.get(id);
    if (component === undefined) {
      return;
    }

    const copy = structuredClone(component) as unknown as Record<string, unknown>;
    const segments = path.split(".");
    const lastKey = segments.pop() as string;

    let cursor: Record<string, unknown> = copy;
    for (const segment of segments) {
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[lastKey] = value;

    this.components.set(id, copy as unknown as Component);
  }

  async deleteById(id: string): Promise<void> {
    this.components.delete(id);
  }
}
