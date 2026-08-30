import type { Component } from "../../../domain/components/component.js";
import { projectLayout } from "../../../domain/components/layout-projection.js";
import type { LayoutEntry } from "../../../domain/components/layout.js";
import type { GridCols } from "../../../domain/components/widget-size.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationLayoutRepository } from "../../../domain/ports/operation-layout.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface GetOperationComponentsInput {
  operationId: string;
  cols: GridCols;
}

export interface GetOperationComponentsResult {
  components: Component[];
  layout: LayoutEntry[];
}

export interface GetOperationComponentsDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  operationLayoutRepository: OperationLayoutRepository;
}

export function createGetOperationComponentsUseCase(deps: GetOperationComponentsDeps) {
  const { operationRepository, componentRepository, operationLayoutRepository } = deps;

  return async function getOperationComponents(
    input: GetOperationComponentsInput,
  ): Promise<GetOperationComponentsResult> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const components = await componentRepository.findByOperationId(input.operationId);
    const operationLayout = await operationLayoutRepository.findByOperationId(input.operationId);
    const saved =
      operationLayout?.breakpoints.find((entry) => entry.cols === input.cols)?.layout ?? [];

    return { components, layout: projectLayout({ components, saved, cols: input.cols }) };
  };
}
