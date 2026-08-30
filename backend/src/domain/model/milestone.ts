export type MilestoneType =
  | "component_created"
  | "component_updated"
  | "component_deleted"
  | "operation_status_changed"
  | "chat_decision_recorded";

export interface Milestone {
  id: string;
  operationId: string;
  type: MilestoneType;
  payload: Record<string, unknown>;
  recordedAt: Date;
}
