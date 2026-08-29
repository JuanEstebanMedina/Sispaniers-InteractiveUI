import type { FastifyInstance } from "fastify";
import { createCreateOperationUseCase } from "../../application/use-cases/dashboard/create-operation.use-case.js";
import { createGetOperationUseCase } from "../../application/use-cases/dashboard/get-operation.use-case.js";
import { createListOperationsUseCase } from "../../application/use-cases/dashboard/list-operations.use-case.js";
import { createSendEmailUseCase } from "../../application/use-cases/send-email.use-case.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";
import { MongoOperationRepository } from "../adapters/outbound/mongo/operation.repository.js";
import { connectMongo } from "./mongo.js";

// TODO: enviar un correo todavía no persiste nada — solo se registra vía logs
// (request.log.warn en las routes). Cuando se retome el guardado, agregar
// EmailRepository en domain/ports/ y wirearlo únicamente aquí.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
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
  const { repository: operationRepository, close } = await buildOperationRepository(
    overrides.operationRepository,
  );

  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const createOperation = createCreateOperationUseCase({ operationRepository, idGenerator });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const listOperations = createListOperationsUseCase({ operationRepository });

  const app = buildApp({ sendEmail, createOperation, getOperation, listOperations });

  if (close !== undefined) {
    app.addHook("onClose", () => close());
  }

  return app;
}
