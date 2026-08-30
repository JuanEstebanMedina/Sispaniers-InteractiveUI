import type { Component } from "../../../../../domain/components/component.js";

export function toComponentWireShape(component: Component) {
  return {
    id: component.id,
    operation_id: component.operationId,
    kind: component.kind,
    ...(component.title !== undefined ? { title: component.title } : {}),
    content: component.children,
    size: component.size,
    created_at: component.createdAt.toISOString(),
  } as const;
}
