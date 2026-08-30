import { EventEmitter } from "node:events";
import type { Operation } from "../../../../domain/logistics/operation.js";
import type {
  OperationEventListener,
  OperationEventName,
  OperationEventPublisher,
} from "../../../../domain/ports/operation-event-publisher.port.js";

// Same single in-process EventEmitter pattern as InMemoryComponentEventPublisher
// — one Fastify instance, no queue/broker. Swap for a real broker if the
// backend ever scales to multiple instances.
export class InMemoryOperationEventPublisher implements OperationEventPublisher {
  private readonly emitter = new EventEmitter();
  private static readonly ALL = "operation-events";

  publish(operationId: string, event: OperationEventName, operation: Operation): void {
    this.emitter.emit(operationId, event, operation);
    this.emitter.emit(InMemoryOperationEventPublisher.ALL, event, operation);
  }

  subscribe(operationId: string, listener: OperationEventListener): () => void {
    this.emitter.on(operationId, listener);
    return () => this.emitter.off(operationId, listener);
  }

  subscribeAll(listener: OperationEventListener): () => void {
    this.emitter.on(InMemoryOperationEventPublisher.ALL, listener);
    return () => this.emitter.off(InMemoryOperationEventPublisher.ALL, listener);
  }
}
