import { z } from "zod";
import { NOTIFICATION_CHANNELS } from "../../../../../domain/enums/notification-channel.js";

export const createCompanyBodySchema = z.object({
  name: z.string().min(1),
  contact_emails: z.array(z.string()).optional(),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS).optional(),
});

export type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>;

export const updateCompanyBodySchema = z.object({
  name: z.string().min(1).optional(),
  contact_emails: z.array(z.string()).optional(),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  /** Disable/re-enable — a disabled company is never deleted. */
  active: z.boolean().optional(),
});

export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>;

export const companyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  contact_emails: z.array(z.string()),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS),
  active: z.boolean(),
});

export const listCompaniesResponseSchema = z.object({
  companies: z.array(companyResponseSchema),
});
