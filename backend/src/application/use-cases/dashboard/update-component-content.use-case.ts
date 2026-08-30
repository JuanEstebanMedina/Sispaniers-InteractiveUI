import {
  setComponentTreePath,
  validateComponentSize,
  validateComponentTree,
} from "../../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../../domain/components/component.js";
import type { WidgetSizeName } from "../../../domain/components/widget-size.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentEventPublisher } from "../../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export type UpdateComponentContentInput =
  | { operationId: string; componentId: string; children: ComponentNode[]; size?: WidgetSizeName }
  | { operationId: string; componentId: string; path: string; value: unknown };

export interface UpdateComponentContentDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  eventPublisher: ComponentEventPublisher;
}

export function createUpdateComponentContentUseCase(deps: UpdateComponentContentDeps) {
  const { operationRepository, componentRepository, eventPublisher } = deps;

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

    const isPathScoped = "path" in input;
    const updatedChildren = isPathScoped
      ? setComponentTreePath(existing.children, input.path, input.value)
      : input.children;

    validateComponentTree(updatedChildren);

    const size = !isPathScoped && input.size !== undefined ? input.size : existing.size;
    if (size !== existing.size) {
      validateComponentSize(size, updatedChildren);
    }

    if (isPathScoped) {
      await componentRepository.setField(existing.id, input.path, input.value);
    } else {
      await componentRepository.save({ ...existing, children: updatedChildren, size });
    }

    const updated: Component = { ...existing, children: updatedChildren, size };
    eventPublisher.publish(updated.operationId, "component-updated", updated);

    return updated;
  };
}
