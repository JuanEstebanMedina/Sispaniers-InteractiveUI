import { ComponentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface DeleteComponentInput {
  operationId: string;
  componentId: string;
}

export interface DeleteComponentDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
}

export function createDeleteComponentUseCase(deps: DeleteComponentDeps) {
  const { operationRepository, componentRepository } = deps;

  return async function deleteComponent(input: DeleteComponentInput): Promise<void> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const existing = await componentRepository.findById(input.componentId);
    if (existing === null || existing.operationId !== input.operationId) {
      throw new ComponentNotFoundError(input.componentId);
    }

    await componentRepository.deleteById(input.componentId);
  };
}
