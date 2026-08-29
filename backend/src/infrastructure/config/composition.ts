import type { FastifyInstance } from "fastify";
import { MongoClient } from "mongodb";
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

// TODO: esta fase no persiste nada — enviar un correo solo se registra vía logs
// (request.log.warn en las routes). Cuando se retome el guardado, agregar
// RunRepository/EmailRepository en domain/ports/ y wirearlos únicamente aquí.

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

async function buildOperationRepository(
  override: OperationRepository | undefined,
): Promise<OperationRepository> {
  if (override !== undefined) {
    return override;
  }
  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017");
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME ?? "sispaniers");
  return new MongoOperationRepository(db);
}

export async function createApp(overrides: CreateAppOverrides = {}): Promise<FastifyInstance> {
  const idGenerator = new CryptoIdGenerator();
  const emailSender = buildEmailSender(overrides.emailSender);
  const operationRepository = await buildOperationRepository(overrides.operationRepository);

  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });
  const createOperation = createCreateOperationUseCase({ operationRepository, idGenerator });
  const getOperation = createGetOperationUseCase({ operationRepository });
  const listOperations = createListOperationsUseCase({ operationRepository });

  return buildApp({ sendEmail, createOperation, getOperation, listOperations });
}
