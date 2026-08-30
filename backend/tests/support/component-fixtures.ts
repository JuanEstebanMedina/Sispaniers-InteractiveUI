import { randomUUID } from "node:crypto";
import type { Component } from "../../src/domain/components/component.js";
import type { LayoutBreakpoint, OperationLayout } from "../../src/domain/components/layout.js";
import type { WidgetSizeName } from "../../src/domain/components/widget-size.js";
import type { ComponentRepository } from "../../src/domain/ports/component.repository.js";
import type { OperationLayoutRepository } from "../../src/domain/ports/operation-layout.repository.js";

export function aComponent(overrides: Partial<Component> = {}): Component {
  return {
    id: randomUUID(),
    operationId: randomUUID(),
    kind: "metric",
    content: { kind: "metric" },
    size: "small" satisfies WidgetSizeName,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Component;
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

  async deleteById(id: string): Promise<void> {
    this.components.delete(id);
  }
}

export class InMemoryOperationLayoutRepository implements OperationLayoutRepository {
  private readonly layouts = new Map<string, OperationLayout>();

  async findByOperationId(operationId: string): Promise<OperationLayout | null> {
    return this.layouts.get(operationId) ?? null;
  }

  async saveBreakpoint(operationId: string, breakpoint: LayoutBreakpoint): Promise<void> {
    const existing = this.layouts.get(operationId);
    const others = (existing?.breakpoints ?? []).filter((entry) => entry.cols !== breakpoint.cols);

    this.layouts.set(operationId, { operationId, breakpoints: [...others, breakpoint] });
  }
}
