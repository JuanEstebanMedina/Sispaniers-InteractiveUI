import type { Document } from "../../../domain/logistics/document.js";
import type { ContextEmail } from "../../../domain/logistics/operation-context.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import type { NormalizedEmail } from "../../../domain/model/email.js";
import type { ExtractedContent } from "../../../domain/model/extracted-content.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { ResolveCompany } from "../shared/resolve-company.use-case.js";

const OPERATION_ID_PATTERN = /orden de compra\s*#\s*([\w-]+)/i;

export function extractOperationIdFromSubject(subject: string): string | undefined {
  return OPERATION_ID_PATTERN.exec(subject)?.[1];
}

// Looks for a labelled "Compañía: <name>" / "Company: <name>" line anywhere
// in the email body — the same free-text convention as the subject's "Orden
// de compra #<id>", not a structured field on the webhook payload. Make
// forwards the raw email; whoever composes it (or the client's own PO
// template) is expected to include this line for the company to be linked
// automatically instead of left unset.
const COMPANY_LINE_PATTERN = /^[ \t]*(?:compañ[ií]a|company)[ \t]*:[ \t]*(.+)$/im;
const CONTACT_LINE_PATTERN = /^[ \t]*(?:contacto|contact)[ \t]*:[ \t]*(.+)$/im;

export interface EmailCompanyInfo {
  name: string;
  contactEmails: string[];
}

export function extractCompanyInfoFromBody(
  bodyText: string | undefined,
): EmailCompanyInfo | undefined {
  if (bodyText === undefined) {
    return undefined;
  }

  const name = COMPANY_LINE_PATTERN.exec(bodyText)?.[1]?.trim();
  if (name === undefined || name.length === 0) {
    return undefined;
  }

  const contact = CONTACT_LINE_PATTERN.exec(bodyText)?.[1]?.trim();

  return { name, contactEmails: contact !== undefined && contact.length > 0 ? [contact] : [] };
}

export interface UpsertOperationFromEmailInput {
  email: NormalizedEmail;
  attachments: ExtractedContent[];
}

export interface UpsertOperationFromEmailResult {
  operationId: string;
  created: boolean;
  companyId?: string;
}

export interface UpsertOperationFromEmailDeps {
  operationRepository: OperationRepository;
  resolveCompany: ResolveCompany;
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
  const { operationRepository, resolveCompany, idGenerator } = deps;

  return async function upsertOperationFromEmail(
    input: UpsertOperationFromEmailInput,
  ): Promise<UpsertOperationFromEmailResult | undefined> {
    const operationId = extractOperationIdFromSubject(input.email.subject);
    if (operationId === undefined) {
      return undefined;
    }

    const existing = await operationRepository.findById(operationId);
    const created = existing === null;

    // Only resolved on first touch — an operation's company link, once set,
    // is never overwritten by a later email in the same thread.
    let companyId = existing?.companyId;
    if (created) {
      const companyInfo = extractCompanyInfoFromBody(input.email.bodyText);
      const company = await resolveCompany(
        companyInfo !== undefined
          ? {
              companyName: companyInfo.name,
              contactEmails:
                companyInfo.contactEmails.length > 0
                  ? companyInfo.contactEmails
                  : [input.email.from],
            }
          : {},
      );
      companyId = company?.id;
    }

    const operation: Operation =
      existing ??
      ({
        id: operationId,
        ...(companyId !== undefined ? { companyId } : {}),
        bookings: [],
        context: { emails: [], documents: [] },
        createdAt: new Date(),
        health: "ok",
      } satisfies Operation);

    const alreadyProcessed = operation.context.emails.some(
      (contextEmail) => contextEmail.messageId === input.email.messageId,
    );
    if (alreadyProcessed) {
      return {
        operationId: operation.id,
        created,
        ...(companyId !== undefined ? { companyId } : {}),
      };
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

    return {
      operationId: updated.id,
      created,
      ...(companyId !== undefined ? { companyId } : {}),
    };
  };
}
