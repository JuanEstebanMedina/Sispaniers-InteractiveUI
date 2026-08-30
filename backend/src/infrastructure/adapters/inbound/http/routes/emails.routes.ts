import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import type { ReceiveEmailResult } from "../../../../../application/use-cases/email/receive-email.use-case.js";
import type {
  SendEmailInput,
  SendEmailResult,
} from "../../../../../application/use-cases/email/send-email.use-case.js";
import type { NormalizedEmail } from "../../../../../domain/model/email.js";
import { EmailSendError } from "../../../../../domain/model/errors.js";
import { toNormalizedEmail } from "../mappers/email.mapper.js";
import { errorResponseSchema } from "../schemas/error.schema.js";
import {
  receiveEmailBodySchema,
  receiveEmailResponseSchema,
} from "../schemas/receive-email.schema.js";
import { sendEmailBodySchema, sendEmailResponseSchema } from "../schemas/send-email.schema.js";

export interface EmailsRouteDeps {
  receiveEmail: (email: NormalizedEmail) => Promise<ReceiveEmailResult>;
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
}

const ATTACHMENT_PREVIEW_LENGTH = 300;

function attachmentLogSummary(attachments: ReceiveEmailResult["attachments"]) {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    mimetype: attachment.mimetype,
    kind: attachment.kind,
    ...(attachment.error !== undefined ? { error: attachment.error } : {}),
    ...(attachment.kind === "text" && attachment.content !== undefined
      ? {
          content_length: attachment.content.length,
          content_preview: attachment.content.slice(0, ATTACHMENT_PREVIEW_LENGTH),
        }
      : {}),
    ...(attachment.kind === "image" && attachment.content !== undefined
      ? { base64_length: attachment.content.length }
      : {}),
    ...(attachment.storagePath !== undefined ? { storage_path: attachment.storagePath } : {}),
    ...(attachment.storageError !== undefined ? { storage_error: attachment.storageError } : {}),
  }));
}

export const emailsRoutes: FastifyPluginAsyncZod<EmailsRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/emails/receive",
    {
      schema: {
        body: receiveEmailBodySchema,
        response: { 201: receiveEmailResponseSchema },
      },
    },
    async (request, reply) => {
      const email = toNormalizedEmail(request.body);
      const { runId, attachments } = await deps.receiveEmail(email);

      request.log.warn(
        {
          message_id: email.messageId,
          source: email.source,
          run_id: runId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          received_at: email.receivedAt,
          body_text: email.bodyText,
          attachments: attachmentLogSummary(attachments),
        },
        "received email",
      );

      reply.code(201).send({ run_id: runId, status: "queued" as const });
    },
  );

  // TODO: proteger este endpoint con un secreto compartido con Make antes de producción
  app.post(
    "/emails/send",
    {
      schema: {
        body: sendEmailBodySchema,
        response: { 201: sendEmailResponseSchema, 502: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const dto = request.body;

      request.log.warn({ run_id: dto.run_id, to: dto.to, subject: dto.subject }, "sending email");

      try {
        const result = await deps.sendEmail({
          runId: dto.run_id,
          to: dto.to,
          subject: dto.subject,
          bodyText: dto.body_text,
          ...(dto.body_html !== undefined ? { bodyHtml: dto.body_html } : {}),
          ...(dto.in_reply_to !== undefined ? { inReplyTo: dto.in_reply_to } : {}),
        });

        request.log.warn({ run_id: dto.run_id, email_id: result.emailId }, "email sent");

        reply.code(201).send({ email_id: result.emailId, status: "sent" as const });
      } catch (error) {
        if (error instanceof EmailSendError) {
          request.log.warn({ run_id: dto.run_id, reason: error.message }, "email send failed");
          reply.code(502).send({ error: "email_send_failed", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
