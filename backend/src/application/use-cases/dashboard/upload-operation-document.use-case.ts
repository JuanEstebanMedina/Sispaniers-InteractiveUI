import type { DocumentType } from "../../../domain/enums/document-type.js";
import type { Document } from "../../../domain/logistics/document.js";
import type { Operation } from "../../../domain/logistics/operation.js";
import { DocumentUploadError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { AttachmentExtractor } from "../../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../../domain/ports/attachment-storage.port.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

const SIGNED_URL_TTL_SECONDS = 300;

export interface UploadOperationDocumentInput {
  operationId: string;
  filename: string;
  mimetype: string;
  data: string;
  type?: DocumentType;
}

export interface UploadOperationDocumentResult {
  document: Document;
  url: string;
  expiresInSeconds: number;
}

export interface UploadOperationDocumentDeps {
  operationRepository: OperationRepository;
  attachmentExtractor: AttachmentExtractor;
  attachmentStorage: AttachmentStorage;
  idGenerator: IdGenerator;
}

export function createUploadOperationDocumentUseCase(deps: UploadOperationDocumentDeps) {
  const { operationRepository, attachmentExtractor, attachmentStorage, idGenerator } = deps;

  return async function uploadOperationDocument(
    input: UploadOperationDocumentInput,
  ): Promise<UploadOperationDocumentResult> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const bucketKey = `${input.operationId}/${input.filename}`;

    try {
      await attachmentStorage.upload({
        path: bucketKey,
        mimetype: input.mimetype,
        data: Buffer.from(input.data, "base64"),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new DocumentUploadError(reason);
    }

    const extracted = await attachmentExtractor.extract({
      filename: input.filename,
      mimetype: input.mimetype,
      data: input.data,
    });

    const document: Document = {
      id: idGenerator.newId(),
      type: input.type ?? "PO",
      format: extracted.format,
      bucketKey,
      extractedData: extracted.format === "image" ? {} : { text: extracted.content ?? null },
      receivedAt: new Date(),
    };

    const updated: Operation = {
      ...operation,
      context: {
        ...operation.context,
        documents: [...operation.context.documents, document],
      },
    };
    await operationRepository.save(updated);

    const url = await attachmentStorage.createSignedUrl(bucketKey, SIGNED_URL_TTL_SECONDS);

    return { document, url, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
  };
}
