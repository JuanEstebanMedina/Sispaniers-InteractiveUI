import type { Operation } from "../logistics/operation.js";

export type OperationEventName = "operation-updated" | "simulation-completed";

export type OperationEventListener = (event: OperationEventName, operation: Operation) => void;

export interface OperationEventPublisher {
  publish(operationId: string, event: OperationEventName, operation: Operation): void;
  subscribe(operationId: string, listener: OperationEventListener): () => void;
}
