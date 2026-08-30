import type { Component } from "../../../domain/components/component.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface UpdateComponentPlacementInput {
  operationId: string;
  componentId: string;
  position?: number;
  title?: string;
}

export interface UpdateComponentPlacementDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
}

function reorder(siblings: Component[], moved: Component, position: number): Component[] {
  const others = siblings
    .filter((component) => component.id !== moved.id)
    .sort((a, b) => a.order - b.order);
  const index = Math.min(Math.max(position, 0), others.length);

  return [...others.slice(0, index), moved, ...others.slice(index)];
}

export function createUpdateComponentPlacementUseCase(deps: UpdateComponentPlacementDeps) {
  const { operationRepository, componentRepository } = deps;

  return async function updateComponentPlacement(
    input: UpdateComponentPlacementInput,
  ): Promise<Component> {
    if ((await operationRepository.findById(input.operationId)) === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const existing = await componentRepository.findById(input.componentId);
    if (existing === null || existing.operationId !== input.operationId) {
      throw new ComponentNotFoundError(input.componentId);
    }

    const renamed =
      input.title === undefined ? existing : renameComponent(existing, input.title.trim());

    if (input.position === undefined) {
      await componentRepository.save(renamed);
      return renamed;
    }

    const siblings = await componentRepository.findByOperationId(input.operationId);
    const sequence = reorder(siblings, renamed, input.position);

    await Promise.all(
      sequence.map((component, order) =>
        component.order === order && component.id !== renamed.id
          ? Promise.resolve()
          : componentRepository.save({ ...component, order }),
      ),
    );

    return { ...renamed, order: sequence.findIndex((component) => component.id === renamed.id) };
  };
}

function renameComponent(component: Component, title: string): Component {
  if (title === "") {
    const { title: _dropped, ...withoutTitle } = component;
    return withoutTitle;
  }

  return { ...component, title };
}
