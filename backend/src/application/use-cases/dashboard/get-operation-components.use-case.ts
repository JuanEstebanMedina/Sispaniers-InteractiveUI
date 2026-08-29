import type { Component } from "../../../domain/components/component.js";
import { packDefaultLayout } from "../../../domain/components/layout-packer.js";
import type { LayoutEntry } from "../../../domain/components/layout.js";
import { WIDGET_SIZES } from "../../../domain/components/widget-size.js";
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

    const savedBreakpoint = operationLayout?.breakpoints.find((entry) => entry.cols === input.cols);
    if (savedBreakpoint !== undefined) {
      return { components, layout: savedBreakpoint.layout };
    }

    const layout = packDefaultLayout(
      components.map((component) => ({ id: component.id, ...WIDGET_SIZES[component.size] })),
      input.cols,
    );

    return { components, layout };
  };
}
