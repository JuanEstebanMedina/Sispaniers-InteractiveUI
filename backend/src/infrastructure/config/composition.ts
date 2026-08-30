import type { FastifyInstance } from "fastify";
import { createCreateComponentUseCase } from "../../application/use-cases/dashboard/create-component.use-case.js";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createDeleteComponentUseCase } from "../../application/use-cases/dashboard/delete-component.use-case.js";
import { createGetDocumentPreviewUrlUseCase } from "../../application/use-cases/dashboard/get-document-preview-url.use-case.js";
import { createGetOperationComponentsUseCase } from "../../application/use-cases/dashboard/get-operation-components.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createUpdateComponentContentUseCase } from "../../application/use-cases/dashboard/update-component-content.use-case.js";
import { createUpdateComponentPlacementUseCase } from "../../application/use-cases/dashboard/update-component-placement.use-case.js";
import { createUploadOperationDocumentUseCase } from "../../application/use-cases/dashboard/upload-operation-document.use-case.js";
import { createReceiveEmailUseCase } from "../../application/use-cases/email/receive-email.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/email/send-email.use-case.js";
import { createUpsertOperationFromEmailUseCase } from "../../application/use-cases/email/upsert-operation-from-email.use-case.js";
import type { AttachmentExtractor } from "../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../domain/ports/attachment-storage.port.js";
import type { CompanyRepository } from "../../domain/ports/company.repository.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { MultiFormatAttachmentExtractor } from "../adapters/outbound/attachment/multi-format-attachment-extractor.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { InMemoryComponentEventPublisher } from "../adapters/outbound/events/in-memory-component-event-publisher.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { MongoCompanyRepository } from "../adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../adapters/outbound/mongo/component.repository.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { SupabaseAttachmentStorage } from "../adapters/outbound/storage/supabase-attachment-storage.js";
import { connectMongo } from "./mongo.js";

// TODO: sending an email still doesn't persist anything — it's only logged
// (request.log.warn in the routes). Receiving an email now persists via
// upsertOperationFromEmail when the subject links to an operation; add an
// EmailRepository in domain/ports/ if a raw send-log is ever needed too.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
  attachmentExtractor?: AttachmentExtractor;
  attachmentStorage?: AttachmentStorage;
  operationRepository?: OperationRepository;
  companyRepository?: CompanyRepository;
  componentRepository?: ComponentRepository;
}

function buildEmailSender(override: EmailSender | undefined): EmailSender {
  if (override !== undefined) {
    return override;
  }
  return new NodemailerEmailSender(
    process.env.GMAIL_USER ?? "",
    process.env.GMAIL_APP_PASSWORD ?? "",
  );
}

function buildAttachmentStorage(override: AttachmentStorage | undefined): AttachmentStorage {
  if (override !== undefined) {
    return override;
  }
  return new SupabaseAttachmentStorage(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

interface RepositorySources {
  operationRepository: OperationRepository;
  companyRepository: CompanyRepository;
  componentRepository: ComponentRepository;
  close?: () => Promise<void>;
}

async function buildRepositories(overrides: CreateAppOverrides): Promise<RepositorySources> {
  const { operationRepository, companyRepository, componentRepository } = overrides;

  if (
    operationRepository !== undefined &&
    companyRepository !== undefined &&
    componentRepository !== undefined
  ) {
    return {
      operationRepository,
      companyRepository,
      componentRepository,
    };
  }

  const mongo = await connectMongo();

  return {
    operationRepository: operationRepository ?? new MongoOperationRepository(mongo.db),
    companyRepository: companyRepository ?? new MongoCompanyRepository(mongo.db),
    componentRepository: componentRepository ?? new MongoComponentRepository(mongo.db),
    close: mongo.close,
  };
}

export async function createApp(overrides: CreateAppOverrides = {}): Promise<FastifyInstance> {
  const idGenerator = new CryptoIdGenerator();
  const emailSender = buildEmailSender(overrides.emailSender);
  const attachmentExtractor = overrides.attachmentExtractor ?? new MultiFormatAttachmentExtractor();
  const attachmentStorage = buildAttachmentStorage(overrides.attachmentStorage);
  const { operationRepository, companyRepository, componentRepository, close } =
    await buildRepositories(overrides);

  const receiveEmail = createReceiveEmailUseCase({
    idGenerator,
    attachmentExtractor,
    attachmentStorage,
  });
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const upsertOperationFromEmail = createUpsertOperationFromEmailUseCase({
    operationRepository,
    idGenerator,
  });
  const createOperation = createCreateOperationUseCase({
    operationRepository,
    companyRepository,
    idGenerator,
  });
  const componentEventPublisher = new InMemoryComponentEventPublisher();
  const createComponent = createCreateComponentUseCase({
    componentRepository,
    idGenerator,
    eventPublisher: componentEventPublisher,
  });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const getDocumentPreviewUrl = createGetDocumentPreviewUrlUseCase({
    operationRepository,
    attachmentStorage,
  });
  const uploadOperationDocument = createUploadOperationDocumentUseCase({
    operationRepository,
    attachmentExtractor,
    attachmentStorage,
    idGenerator,
  });
  const listOperations = createListOperationsUseCase({ operationRepository, companyRepository });
  const getOperationComponents = createGetOperationComponentsUseCase({
    operationRepository,
    componentRepository,
  });
  const updateComponentPlacement = createUpdateComponentPlacementUseCase({
    operationRepository,
    componentRepository,
  });
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: componentEventPublisher,
  });
  const deleteComponent = createDeleteComponentUseCase({
    operationRepository,
    componentRepository,
  });

  const app = buildApp({
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    createOperation,
    getOperation,
    listOperations,
    getDocumentPreviewUrl,
    uploadOperationDocument,
    getOperationComponents,
    updateComponentPlacement,
    updateComponentContent,
    createComponent,
    deleteComponent,
    componentEventPublisher,
  });

  app.decorate("createComponent", createComponent);

  if (close !== undefined) {
    app.addHook("onClose", () => close());
  }

  return app;
}
