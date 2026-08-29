import type { FastifyInstance } from "fastify";
import { createListOperationsUseCase } from "../../application/use-cases/list-operations.use-case.js";
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

export async function createApp(overrides: CreateAppOverrides = {}): Promise<FastifyInstance> {
  const emailSender = buildEmailSender(overrides.emailSender);
  const idGenerator = new CryptoIdGenerator();

  const assemble = (operations: OperationRepository): FastifyInstance =>
    buildApp({
      sendEmail: createSendEmailUseCase({ emailSender, idGenerator }),
      listOperations: createListOperationsUseCase({ operations }),
    });

  if (overrides.operationRepository !== undefined) {
    return assemble(overrides.operationRepository);
  }

  const mongo = await connectMongo();
  const app = assemble(new MongoOperationRepository(mongo.db));

  app.addHook("onClose", () => mongo.close());

  return app;
}
