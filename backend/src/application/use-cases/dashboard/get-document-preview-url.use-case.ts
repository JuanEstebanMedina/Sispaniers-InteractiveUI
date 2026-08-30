import { DocumentNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { AttachmentStorage } from "../../../domain/ports/attachment-storage.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

const SIGNED_URL_TTL_SECONDS = 300;

export interface GetDocumentPreviewUrlInput {
  operationId: string;
  documentId: string;
}

export interface GetDocumentPreviewUrlResult {
  url: string;
  expiresInSeconds: number;
}

export interface GetDocumentPreviewUrlDeps {
  operationRepository: OperationRepository;
  attachmentStorage: AttachmentStorage;
}

export function createGetDocumentPreviewUrlUseCase(deps: GetDocumentPreviewUrlDeps) {
  const { operationRepository, attachmentStorage } = deps;

  return async function getDocumentPreviewUrl(
    input: GetDocumentPreviewUrlInput,
  ): Promise<GetDocumentPreviewUrlResult> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const document = operation.context.documents.find((doc) => doc.id === input.documentId);
    if (document === undefined) {
      throw new DocumentNotFoundError(input.documentId);
    }

    const url = await attachmentStorage.createSignedUrl(document.bucketKey, SIGNED_URL_TTL_SECONDS);

    return { url, expiresInSeconds: SIGNED_URL_TTL_SECONDS };
  };
}
