import type { Component } from "../../../domain/components/component.js";
import { packDefaultLayout } from "../../../domain/components/layout-packer.js";
import type { LayoutEntry } from "../../../domain/components/layout.js";
import { type GridCols, WIDGET_SIZES } from "../../../domain/components/widget-size.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
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
}

export function createGetOperationComponentsUseCase(deps: GetOperationComponentsDeps) {
  const { operationRepository, componentRepository } = deps;

  return async function getOperationComponents(
    input: GetOperationComponentsInput,
  ): Promise<GetOperationComponentsResult> {
    if ((await operationRepository.findById(input.operationId)) === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const components = [...(await componentRepository.findByOperationId(input.operationId))].sort(
      (a, b) => a.order - b.order,
    );
    const layout = packDefaultLayout(
      components.map((component) => ({ id: component.id, ...WIDGET_SIZES[component.size] })),
      input.cols,
    );

    return { components, layout };
  };
}
