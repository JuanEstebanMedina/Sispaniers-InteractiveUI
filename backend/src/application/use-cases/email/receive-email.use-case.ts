import type { ExtractedAttachment } from "../../../domain/model/attachment-content.js";
import type { EmailAttachment, NormalizedEmail } from "../../../domain/model/email.js";
import type { AttachmentExtractor } from "../../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../../domain/ports/attachment-storage.port.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface ReceiveEmailResult {
  runId: string;
  attachments: ExtractedAttachment[];
}

export interface ReceiveEmailDeps {
  idGenerator: IdGenerator;
  attachmentExtractor: AttachmentExtractor;
  attachmentStorage: AttachmentStorage;
}

async function storeAttachment(
  messageId: string,
  attachment: EmailAttachment,
  attachmentStorage: AttachmentStorage,
): Promise<Pick<ExtractedAttachment, "storagePath" | "storageError">> {
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

// TODO: conecta el agente real aquí — por ahora se extrae el contenido de los
// adjuntos (texto/imagen según el tipo), se sube el archivo original a Supabase
// Storage, y se registra la recepción, sin persistencia en base de datos todavía
// (ver domain/ports para el contrato de un futuro RunRepository).
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
