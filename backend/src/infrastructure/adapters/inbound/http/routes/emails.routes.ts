import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import type { EnrollOperationInSimulationInput } from "../../../../../application/use-cases/dashboard/enroll-operation-in-simulation.use-case.js";
import type { GenerateComponentFromAiInput } from "../../../../../application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import type { MarkEmailSentInput } from "../../../../../application/use-cases/email/mark-email-sent.use-case.js";
import type { ReceiveEmailResult } from "../../../../../application/use-cases/email/receive-email.use-case.js";
import type {
  SendEmailInput,
  SendEmailResult,
} from "../../../../../application/use-cases/email/send-email.use-case.js";
import type {
  UpsertOperationFromEmailInput,
  UpsertOperationFromEmailResult,
} from "../../../../../application/use-cases/email/upsert-operation-from-email.use-case.js";
import type { NormalizedEmail } from "../../../../../domain/model/email.js";
import { CompanyDisabledError, EmailSendError } from "../../../../../domain/model/errors.js";
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
  markEmailSent: (input: MarkEmailSentInput) => Promise<unknown>;
  upsertOperationFromEmail: (
    input: UpsertOperationFromEmailInput,
  ) => Promise<UpsertOperationFromEmailResult | undefined>;
  enrollOperationInSimulation: (input: EnrollOperationInSimulationInput) => Promise<void>;
  generateComponentFromAi: (
    input: GenerateComponentFromAiInput,
  ) => Promise<{ component: unknown; reply: string }>;
}

const ATTACHMENT_PREVIEW_LENGTH = 300;

function attachmentLogSummary(attachments: ReceiveEmailResult["attachments"]) {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    mimetype: attachment.mimetype,
    format: attachment.format,
    ...(attachment.error !== undefined ? { error: attachment.error } : {}),
    ...(attachment.format !== "image" && attachment.content !== undefined
      ? {
          content_length: attachment.content.length,
          content_preview: attachment.content.slice(0, ATTACHMENT_PREVIEW_LENGTH),
        }
      : {}),
    ...(attachment.format === "image" && attachment.content !== undefined
      ? { base64_length: attachment.content.length }
      : {}),
    ...(attachment.storagePath !== undefined ? { storage_path: attachment.storagePath } : {}),
    ...(attachment.storageError !== undefined ? { storage_error: attachment.storageError } : {}),
  }));
}

function toInboundAiInput(email: NormalizedEmail, attachments: ReceiveEmailResult["attachments"]) {
  return JSON.stringify({
    event: "email_received",
    email: {
      from: email.from,
      ...(email.to === undefined ? {} : { to: email.to }),
      subject: email.subject,
      receivedAt: email.receivedAt,
      ...(email.bodyText === undefined ? {} : { bodyText: email.bodyText }),
    },
    attachments: attachments
      .filter((attachment) => attachment.format !== "image" && attachment.content !== undefined)
      .map((attachment) => ({
        filename: attachment.filename,
        format: attachment.format,
        content: attachment.content,
      })),
  });
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
      const operationResult = await deps.upsertOperationFromEmail({ email, attachments });

      if (operationResult?.created === true) {
        await deps.enrollOperationInSimulation({
          operationId: operationResult.operationId,
          ...(operationResult.companyId !== undefined
            ? { companyId: operationResult.companyId }
            : {}),
        });
      }

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
          operation_id: operationResult?.operationId,
          operation_created: operationResult?.created,
        },
        "received email",
      );

      reply.code(201).send({
        run_id: runId,
        status: "queued" as const,
        ...(operationResult !== undefined ? { operation_id: operationResult.operationId } : {}),
      });

      if (operationResult !== undefined) {
        // ponytail: no durable job queue yet. Failed work is logged but lost
        // on process restart; add one when inbound delivery guarantees matter.
        void deps
          .generateComponentFromAi({
            operationId: operationResult.operationId,
            trigger: "auto",
            input: toInboundAiInput(email, attachments),
          })
          .catch((error: unknown) => {
            request.log.error(
              { err: error, operation_id: operationResult.operationId },
              "inbound AI processing failed",
            );
          });
      }
    },
  );

  // TODO: protect this endpoint with a secret shared with Make before production
  app.post(
    "/emails/send",
    {
      schema: {
        body: sendEmailBodySchema,
        response: {
          201: sendEmailResponseSchema,
          403: errorResponseSchema,
          502: errorResponseSchema,
        },
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

        // The widget the draft came from has to stop offering to send it, and
        // the agent has to be able to see it left. Both read the component, so
        // the send is only a fact once it is written back onto that node.
        if (dto.component_id !== undefined) {
          await deps.markEmailSent({
            componentId: dto.component_id,
            to: dto.to,
            subject: dto.subject,
            body: dto.body_text,
            sentAt: new Date(),
          });
        }

        reply.code(201).send({ email_id: result.emailId, status: "sent" as const });
      } catch (error) {
        if (error instanceof CompanyDisabledError) {
          request.log.warn({ run_id: dto.run_id, reason: error.message }, "email send blocked");
          reply.code(403).send({ error: "company_disabled", message: error.message });
          return;
        }
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
