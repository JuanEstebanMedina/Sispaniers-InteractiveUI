import { EventEmitter } from "node:events";

import type {
  ComponentEvent,
  ComponentEventsBroadcaster,
} from "../../../../domain/ports/component-events.port.js";

// ponytail: single-instance in-memory pub/sub. Upgrade to Redis pub/sub if the
// app ever runs more than one Fastify instance behind a load balancer.
export class InMemoryComponentEventsBroadcaster implements ComponentEventsBroadcaster {
  private readonly emitter = new EventEmitter();

  publish(operationId: string, event: ComponentEvent): void {
    this.emitter.emit(operationId, event);
  }

  subscribe(operationId: string, listener: (event: ComponentEvent) => void): () => void {
    this.emitter.on(operationId, listener);
    return () => {
      this.emitter.off(operationId, listener);
    };
  }
}
