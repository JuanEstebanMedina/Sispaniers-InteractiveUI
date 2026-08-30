import { type Component, bySequence } from "../../../domain/components/component.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import { createKeyedQueue } from "../../support/keyed-queue.js";

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
  const others = siblings.filter((component) => component.id !== moved.id).sort(bySequence);
  const index = Math.min(Math.max(position, 0), others.length);

  return [...others.slice(0, index), moved, ...others.slice(index)];
}

export function createUpdateComponentPlacementUseCase(deps: UpdateComponentPlacementDeps) {
  const { operationRepository, componentRepository } = deps;
  // Renumbering the sequence means reading it, rewriting it, and storing it
  // back. The front fires one of these per drag without waiting for the last,
  // so two overlap easily — and the second would read orders the first had not
  // written yet, leaving a stored sequence that matches neither drag.
  const enqueue = createKeyedQueue();

  async function place(input: UpdateComponentPlacementInput): Promise<Component> {
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
  }

  return async function updateComponentPlacement(
    input: UpdateComponentPlacementInput,
  ): Promise<Component> {
    return enqueue(input.operationId, () => place(input));
  };
}

function renameComponent(component: Component, title: string): Component {
  if (title === "") {
    const { title: _dropped, ...withoutTitle } = component;
    return withoutTitle;
  }

  return { ...component, title };
}
