import { projectLayout } from "../../../domain/components/layout-projection.js";
import type { LayoutEntry, LayoutPosition } from "../../../domain/components/layout.js";
import type { GridCols } from "../../../domain/components/widget-size.js";
import { OperationNotFoundError } from "../../../domain/model/errors.js";
import type { ComponentRepository } from "../../../domain/ports/component.repository.js";
import type { OperationLayoutRepository } from "../../../domain/ports/operation-layout.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface UpdateOperationLayoutInput {
  operationId: string;
  cols: GridCols;
  layout: LayoutPosition[];
}

export interface UpdateOperationLayoutResult {
  cols: GridCols;
  layout: LayoutEntry[];
}

export interface UpdateOperationLayoutDeps {
  operationRepository: OperationRepository;
  componentRepository: ComponentRepository;
  operationLayoutRepository: OperationLayoutRepository;
}

export function createUpdateOperationLayoutUseCase(deps: UpdateOperationLayoutDeps) {
  const { operationRepository, componentRepository, operationLayoutRepository } = deps;

  return async function updateOperationLayout(
    input: UpdateOperationLayoutInput,
  ): Promise<UpdateOperationLayoutResult> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const components = await componentRepository.findByOperationId(input.operationId);
    const layout = projectLayout({ components, saved: input.layout, cols: input.cols });

    await operationLayoutRepository.saveBreakpoint(input.operationId, { cols: input.cols, layout });

    return { cols: input.cols, layout };
  };
}
