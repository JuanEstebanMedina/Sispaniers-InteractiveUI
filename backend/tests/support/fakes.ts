import type {
  AttachmentStorage,
  UploadAttachmentInput,
} from "../../src/domain/ports/attachment-storage.port.js";
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

export class FakeAttachmentStorage implements AttachmentStorage {
  public readonly uploaded: UploadAttachmentInput[] = [];
  public failWith: Error | undefined;

  upload(input: UploadAttachmentInput): Promise<void> {
    if (this.failWith !== undefined) {
      return Promise.reject(this.failWith);
    }
    this.uploaded.push(input);
    return Promise.resolve();
  }

  createSignedUrl(path: string): Promise<string> {
    return Promise.resolve(`https://fake-storage.test/${path}`);
  }
}
