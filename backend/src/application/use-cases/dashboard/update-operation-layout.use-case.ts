import type { LayoutEntry } from "../../../domain/components/layout.js";
import { type GridCols, isValidWidgetWidth } from "../../../domain/components/widget-size.js";
import { InvalidLayoutError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { OperationLayoutRepository } from "../../../domain/ports/operation-layout.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface UpdateOperationLayoutInput {
  operationId: string;
  cols: GridCols;
  layout: LayoutEntry[];
}

export interface UpdateOperationLayoutResult {
  cols: GridCols;
  layout: LayoutEntry[];
}

export interface UpdateOperationLayoutDeps {
  operationRepository: OperationRepository;
  operationLayoutRepository: OperationLayoutRepository;
}

export function createUpdateOperationLayoutUseCase(deps: UpdateOperationLayoutDeps) {
  const { operationRepository, operationLayoutRepository } = deps;

  return async function updateOperationLayout(
    input: UpdateOperationLayoutInput,
  ): Promise<UpdateOperationLayoutResult> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    for (const entry of input.layout) {
      if (!isValidWidgetWidth(entry.w, input.cols)) {
        throw new InvalidLayoutError(
          `entry ${entry.id} has width ${entry.w}, invalid for cols=${input.cols}`,
        );
      }
    }

    await operationLayoutRepository.saveBreakpoint(input.operationId, {
      cols: input.cols,
      layout: input.layout,
    });

    return { cols: input.cols, layout: input.layout };
  };
}
