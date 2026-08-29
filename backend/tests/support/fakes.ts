import type {
  EmailSender,
  OutboundEmailMessage,
} from "../../src/domain/ports/email-sender.port.js";

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
