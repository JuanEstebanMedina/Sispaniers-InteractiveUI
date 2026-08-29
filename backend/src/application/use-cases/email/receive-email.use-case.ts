import type { ExtractedAttachment } from "../../../domain/model/attachment-content.js";
import type { NormalizedEmail } from "../../../domain/model/email.js";
import type { AttachmentExtractor } from "../../../domain/ports/attachment-extractor.port.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface ReceiveEmailResult {
  runId: string;
  attachments: ExtractedAttachment[];
}

export interface ReceiveEmailDeps {
  idGenerator: IdGenerator;
  attachmentExtractor: AttachmentExtractor;
}

// TODO: conecta el agente real aquí — por ahora solo se extrae el contenido de
// los adjuntos (texto/imagen según el tipo) y se registra la recepción, sin
// persistencia todavía (ver domain/ports para el contrato de un futuro
// RunRepository).
export function createReceiveEmailUseCase(deps: ReceiveEmailDeps) {
  const { idGenerator, attachmentExtractor } = deps;

  return async function receiveEmail(email: NormalizedEmail): Promise<ReceiveEmailResult> {
    const attachments = await Promise.all(
      (email.attachments ?? []).map((attachment) => attachmentExtractor.extract(attachment)),
    );

    return { runId: idGenerator.newId(), attachments };
  };
}
