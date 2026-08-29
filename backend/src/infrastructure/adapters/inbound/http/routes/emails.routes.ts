import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import type {
  SendEmailInput,
  SendEmailResult,
} from "../../../../../application/use-cases/send-email.use-case.js";
import { EmailSendError } from "../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../schemas/error.schema.js";
import { sendEmailBodySchema, sendEmailResponseSchema } from "../schemas/send-email.schema.js";

export interface EmailsRouteDeps {
  sendEmail: (input: SendEmailInput) => Promise<SendEmailResult>;
}

export const emailsRoutes: FastifyPluginAsyncZod<EmailsRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

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
