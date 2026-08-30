import type { Document } from "../../../domain/logistics/document.js";
import type { ContextEmail } from "../../../domain/logistics/operation-context.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import type { NormalizedEmail } from "../../../domain/model/email.js";
import type { ExtractedContent } from "../../../domain/model/extracted-content.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

const OPERATION_ID_PATTERN = /orden de compra\s*#\s*([\w-]+)/i;

export function extractOperationIdFromSubject(subject: string): string | undefined {
  return OPERATION_ID_PATTERN.exec(subject)?.[1];
}

export interface UpsertOperationFromEmailInput {
  email: NormalizedEmail;
  attachments: ExtractedContent[];
}

export interface UpsertOperationFromEmailResult {
  operationId: string;
  created: boolean;
}

export interface UpsertOperationFromEmailDeps {
  operationRepository: OperationRepository;
  idGenerator: IdGenerator;
}

function toContextEmail(email: NormalizedEmail): ContextEmail {
  return {
    source: email.source,
    messageId: email.messageId,
    from: email.from,
    ...(email.to !== undefined ? { to: email.to } : {}),
    subject: email.subject,
    receivedAt: new Date(email.receivedAt),
    ...(email.bodyText !== undefined ? { bodyText: email.bodyText } : {}),
  };
}

function toDocument(
  attachment: ExtractedContent,
  messageId: string,
  idGenerator: IdGenerator,
): Document | undefined {
  // Without a bucketKey the document doesn't point at any real file — not
  // worth persisting it (the attachment never made it to Supabase Storage).
  if (attachment.storagePath === undefined) {
    return undefined;
  }

  return {
    id: idGenerator.newId(),
    // TODO: classify the document's real type (invoice, BL, packing list...)
    // — for now everything arriving through this flow is assumed to be a PO.
    type: "PO",
    format: attachment.format,
    bucketKey: attachment.storagePath,
    sourceEmailId: messageId,
    extractedData: attachment.format === "image" ? {} : { text: attachment.content ?? null },
    receivedAt: new Date(),
  };
}

// TODO: wire up the real agent here — today the email↔operation link is
// purely textual (the id comes from the subject "Orden de compra #<id>");
// later a real agent will decide which operation each email belongs to.
export function createUpsertOperationFromEmailUseCase(deps: UpsertOperationFromEmailDeps) {
  const { operationRepository, idGenerator } = deps;

  return async function upsertOperationFromEmail(
    input: UpsertOperationFromEmailInput,
  ): Promise<UpsertOperationFromEmailResult | undefined> {
    const operationId = extractOperationIdFromSubject(input.email.subject);
    if (operationId === undefined) {
      return undefined;
    }

    const existing = await operationRepository.findById(operationId);
    const created = existing === null;

    const operation: Operation =
      existing ??
      ({
        id: operationId,
        bookings: [],
        context: { emails: [], documents: [] },
        createdAt: new Date(),
        health: "ok",
      } satisfies Operation);

    const alreadyProcessed = operation.context.emails.some(
      (contextEmail) => contextEmail.messageId === input.email.messageId,
    );
    if (alreadyProcessed) {
      return { operationId: operation.id, created };
    }

    const newDocuments = input.attachments
      .map((attachment) => toDocument(attachment, input.email.messageId, idGenerator))
      .filter((document): document is Document => document !== undefined);

    const updated: Operation = {
      ...operation,
      context: {
        emails: [...operation.context.emails, toContextEmail(input.email)],
        documents: [...operation.context.documents, ...newDocuments],
      },
    };

    await operationRepository.save(updated);

    return { operationId: updated.id, created };
  };
}
