import type { Operation } from "../../src/domain/logistics/operation.js";
import type {
  EmailSender,
  OutboundEmailMessage,
} from "../../src/domain/ports/email-sender.port.js";
import type { OperationRepository } from "../../src/domain/ports/operation.repository.js";

export class FakeEmailSender implements EmailSender {
  public readonly sent: OutboundEmailMessage[] = [];
  public failWith: Error | undefined;

  send(message: OutboundEmailMessage): Promise<{ providerMessageId?: string }> {
    if (this.failWith !== undefined) {
      return Promise.reject(this.failWith);
    }
    this.sent.push(message);
    return Promise.resolve({ providerMessageId: `fake-${this.sent.length}` });
  }
}

export class FakeOperationRepository implements OperationRepository {
  public readonly stored = new Map<string, Operation>();

  findById(id: string): Promise<Operation | null> {
    return Promise.resolve(this.stored.get(id) ?? null);
  }

  findActiveByClient(clientId: string): Promise<Operation[]> {
    return Promise.resolve([...this.stored.values()].filter((it) => it.clientId === clientId));
  }

  findAll(): Promise<Operation[]> {
    return Promise.resolve([...this.stored.values()]);
  }

  save(operation: Operation): Promise<void> {
    this.stored.set(operation.id, operation);
    return Promise.resolve();
  }
}
