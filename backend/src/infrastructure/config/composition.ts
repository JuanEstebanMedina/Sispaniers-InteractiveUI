import type { FastifyInstance } from "fastify";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createReceiveEmailUseCase } from "../../application/use-cases/email/receive-email.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/email/send-email.use-case.js";
import type { AttachmentExtractor } from "../../domain/ports/attachment-extractor.port.js";
import type { AttachmentStorage } from "../../domain/ports/attachment-storage.port.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { MultiFormatAttachmentExtractor } from "../adapters/outbound/attachment/multi-format-attachment-extractor.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { SupabaseAttachmentStorage } from "../adapters/outbound/storage/supabase-attachment-storage.js";
import { connectMongo } from "./mongo.js";

// TODO: recibir/enviar correo todavía no persiste nada — solo se registra vía
// logs (request.log.warn en las routes). Cuando se retome el guardado, agregar
// RunRepository/EmailRepository en domain/ports/ y wirearlos únicamente aquí.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
  attachmentExtractor?: AttachmentExtractor;
  attachmentStorage?: AttachmentStorage;
  operationRepository?: OperationRepository;
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

interface OperationRepositorySource {
  repository: OperationRepository;
  close?: () => Promise<void>;
}

async function buildOperationRepository(
  override: OperationRepository | undefined,
): Promise<OperationRepositorySource> {
  if (override !== undefined) {
    return { repository: override };
  }
  const mongo = await connectMongo();
  return { repository: new MongoOperationRepository(mongo.db), close: mongo.close };
}

export async function createApp(overrides: CreateAppOverrides = {}): Promise<FastifyInstance> {
  const idGenerator = new CryptoIdGenerator();
  const emailSender = buildEmailSender(overrides.emailSender);
  const attachmentExtractor = overrides.attachmentExtractor ?? new MultiFormatAttachmentExtractor();
  const attachmentStorage = buildAttachmentStorage(overrides.attachmentStorage);
  const { repository: operationRepository, close } = await buildOperationRepository(
    overrides.operationRepository,
  );

  const receiveEmail = createReceiveEmailUseCase({
    idGenerator,
    attachmentExtractor,
    attachmentStorage,
  });
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const createOperation = createCreateOperationUseCase({ operationRepository, idGenerator });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const listOperations = createListOperationsUseCase({ operationRepository });

  const app = buildApp({
    receiveEmail,
    sendEmail,
    createOperation,
    getOperation,
    listOperations,
  });

  if (close !== undefined) {
    app.addHook("onClose", () => close());
  }

  return app;
}
