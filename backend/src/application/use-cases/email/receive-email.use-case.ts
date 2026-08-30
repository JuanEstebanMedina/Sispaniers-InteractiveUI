import type { IncomingAttachment, NormalizedEmail } from "../../../domain/model/email.js";
import type { ExtractedContent } from "../../../domain/model/extracted-content.js";
import type { AttachmentExtractor } from "../../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../../domain/ports/attachment-storage.port.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface ReceiveEmailResult {
  runId: string;
  attachments: ExtractedContent[];
}

export interface ReceiveEmailDeps {
  idGenerator: IdGenerator;
  attachmentExtractor: AttachmentExtractor;
  attachmentStorage: AttachmentStorage;
}

async function storeAttachment(
  messageId: string,
  attachment: IncomingAttachment,
  attachmentStorage: AttachmentStorage,
): Promise<Pick<ExtractedContent, "storagePath" | "storageError">> {
  if (attachment.data === undefined || attachment.mimetype === undefined) {
    return {};
  }

  const path = `${messageId}/${attachment.filename ?? "file"}`;

  try {
    await attachmentStorage.upload({
      path,
      mimetype: attachment.mimetype,
      data: Buffer.from(attachment.data, "base64"),
    });
    return { storagePath: path };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { storageError: reason };
  }
}

// TODO: wire up the real agent here — for now this only extracts each
// attachment's content (text/image depending on type), uploads the original
// file to Supabase Storage, and logs the receipt, with no database
// persistence yet (see domain/ports for the contract of a future
// RunRepository).
export function createReceiveEmailUseCase(deps: ReceiveEmailDeps) {
  const { idGenerator, attachmentExtractor, attachmentStorage } = deps;

  return async function receiveEmail(email: NormalizedEmail): Promise<ReceiveEmailResult> {
    const attachments = await Promise.all(
      (email.attachments ?? []).map(async (attachment) => {
        const [extracted, stored] = await Promise.all([
          attachmentExtractor.extract(attachment),
          storeAttachment(email.messageId, attachment, attachmentStorage),
        ]);
        return { ...extracted, ...stored };
      }),
    );

    return { runId: idGenerator.newId(), attachments };
  };
}
