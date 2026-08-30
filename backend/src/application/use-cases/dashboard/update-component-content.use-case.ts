import type { Component } from "../../../domain/components/component.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface UpdateComponentContentInput {
  operationId: string;
  componentId: string;
  content: Record<string, unknown>;
}

export interface UpdateComponentContentDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
}

export function createUpdateComponentContentUseCase(deps: UpdateComponentContentDeps) {
  const { operationRepository, componentRepository } = deps;

  return async function updateComponentContent(
    input: UpdateComponentContentInput,
  ): Promise<Component> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const existing = await componentRepository.findById(input.componentId);
    if (existing === null || existing.operationId !== input.operationId) {
      throw new ComponentNotFoundError(input.componentId);
    }

    let updated: Component;
    switch (existing.kind) {
      case "map":
        updated = { ...existing, kind: "map", content: { ...input.content, kind: "map" } };
        break;
      case "metric":
        updated = { ...existing, kind: "metric", content: { ...input.content, kind: "metric" } };
        break;
      case "decision-panel":
        updated = {
          ...existing,
          kind: "decision-panel",
          content: { ...input.content, kind: "decision-panel" },
        };
        break;
      case "timeline":
        updated = {
          ...existing,
          kind: "timeline",
          content: { ...input.content, kind: "timeline" },
        };
        break;
    }

    await componentRepository.save(updated);

    return updated;
  };
}
