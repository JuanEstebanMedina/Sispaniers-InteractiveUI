import type { LayoutBreakpoint, OperationLayout } from "../components/layout.js";

export interface OperationLayoutRepository {
  findByOperationId(operationId: string): Promise<OperationLayout | null>;
  saveBreakpoint(operationId: string, breakpoint: LayoutBreakpoint): Promise<void>;
}
