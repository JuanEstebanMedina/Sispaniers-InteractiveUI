import type { LayoutBreakpoint, OperationLayout } from "../../../../domain/components/layout.js";

export interface OperationLayoutDocument {
  _id: string;
  breakpoints: LayoutBreakpoint[];
}

export function toOperationLayoutDocument({
  operationId,
  breakpoints,
}: OperationLayout): OperationLayoutDocument {
  return { _id: operationId, breakpoints };
}

export function toOperationLayout({ _id, breakpoints }: OperationLayoutDocument): OperationLayout {
  return { operationId: _id, breakpoints };
}
