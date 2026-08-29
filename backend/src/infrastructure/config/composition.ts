import type { FastifyInstance } from "fastify";
import { createSendEmailUseCase } from "../../application/use-cases/send-email.use-case.js";
import type { EmailSender } from "../../domain/ports/email-sender.port.js";
import { buildApp } from "../adapters/inbound/http/app.js";
import { NodemailerEmailSender } from "../adapters/outbound/email/nodemailer-email-sender.js";
import { CryptoIdGenerator } from "../adapters/outbound/id/crypto-id-generator.js";

// TODO: esta fase no persiste nada — enviar un correo solo se registra vía logs
// (request.log.warn en las routes). Cuando se retome el guardado, agregar
// RunRepository/EmailRepository en domain/ports/ y wirearlos únicamente aquí.

export interface CreateAppOverrides {
  emailSender?: EmailSender;
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

export function createApp(overrides: CreateAppOverrides = {}): FastifyInstance {
  const idGenerator = new CryptoIdGenerator();
  const emailSender = buildEmailSender(overrides.emailSender);

  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator });

  return buildApp({ sendEmail });
}
