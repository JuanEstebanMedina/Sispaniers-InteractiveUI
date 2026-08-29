import { z } from "zod";

export const sendEmailBodySchema = z.object({
  run_id: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1),
  body_text: z.string().min(1),
  body_html: z.string().optional(),
  in_reply_to: z.string().optional(),
});

export type SendEmailBody = z.infer<typeof sendEmailBodySchema>;

export const sendEmailResponseSchema = z.object({
  email_id: z.string(),
  status: z.literal("sent"),
});
