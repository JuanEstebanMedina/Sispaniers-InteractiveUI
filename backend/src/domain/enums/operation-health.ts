export const OPERATION_HEALTH_STATES = ["ok", "warning", "error"] as const;

export type OperationHealth = (typeof OPERATION_HEALTH_STATES)[number];
