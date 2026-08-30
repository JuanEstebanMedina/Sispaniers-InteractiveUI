import { EventEmitter } from "node:events";
import type {
  ComponentEventListener,
  ComponentEventName,
  ComponentEventPayload,
  ComponentEventPublisher,
} from "../../../../domain/ports/component-event-publisher.port.js";

// ponytail: single in-process EventEmitter keyed by operationId — matches
// Engram #284's finding of a single Fastify instance with no queue/broker
// today. Swap for a real broker if the backend ever scales to multiple
// instances.
export class InMemoryComponentEventPublisher implements ComponentEventPublisher {
  private readonly emitter = new EventEmitter();

  publish(operationId: string, event: ComponentEventName, payload: ComponentEventPayload): void {
    this.emitter.emit(operationId, event, payload);
  }

  subscribe(operationId: string, listener: ComponentEventListener): () => void {
    this.emitter.on(operationId, listener);
    return () => this.emitter.off(operationId, listener);
  }
}
