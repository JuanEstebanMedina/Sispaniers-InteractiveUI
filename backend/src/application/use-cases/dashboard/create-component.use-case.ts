import type { Component } from "../../../domain/components/component.js";
import type { WidgetSizeName } from "../../../domain/components/widget-size.js";
import type { WidgetKind } from "../../../domain/enums/widget-kind.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface CreateComponentInput {
  operationId: string;
  kind: WidgetKind;
  content: Record<string, unknown>;
  size: WidgetSizeName;
}

export interface CreateComponentDeps {
  componentRepository: ComponentRepository;
  idGenerator: IdGenerator;
}

export function createCreateComponentUseCase(deps: CreateComponentDeps) {
  const { componentRepository, idGenerator } = deps;

  return async function createComponent(input: CreateComponentInput): Promise<Component> {
    const base = {
      id: idGenerator.newId(),
      operationId: input.operationId,
      size: input.size,
      createdAt: new Date(),
    };

    let component: Component;
    switch (input.kind) {
      case "map":
        component = { ...base, kind: "map", content: { ...input.content, kind: "map" } };
        break;
      case "metric":
        component = { ...base, kind: "metric", content: { ...input.content, kind: "metric" } };
        break;
      case "decision-panel":
        component = {
          ...base,
          kind: "decision-panel",
          content: { ...input.content, kind: "decision-panel" },
        };
        break;
      case "timeline":
        component = { ...base, kind: "timeline", content: { ...input.content, kind: "timeline" } };
        break;
    }

    await componentRepository.save(component);

    return component;
  };
}
