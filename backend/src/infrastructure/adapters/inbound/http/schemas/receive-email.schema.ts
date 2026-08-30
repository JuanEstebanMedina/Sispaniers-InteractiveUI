import { z } from "zod";

export const emailSourceSchema = z.enum(["make", "gmail", "outlook", "manual"]);

export const emailAttachmentSchema = z.object({
  filename: z.string().optional(),
  mimetype: z.string().optional(),
  data: z.string().optional(),
});

export const receiveEmailBodySchema = z.object({
  source: emailSourceSchema,
  message_id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().optional(),
  subject: z.string().min(1),
  received_at: z.string().datetime({ offset: true }),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
});

export type ReceiveEmailBody = z.infer<typeof receiveEmailBodySchema>;

export const receiveEmailResponseSchema = z.object({
  run_id: z.string(),
  status: z.literal("queued"),
  operation_id: z.string().optional(),
});

export type ReceiveEmailResponse = z.infer<typeof receiveEmailResponseSchema>;
