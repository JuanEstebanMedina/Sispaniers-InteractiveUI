import { z } from 'zod'

import { idSchema, validators } from './common.schema'

export const NOTIFICATION_CHANNELS = ['email', 'slack'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/**
 * `POST /api/companies` is idempotent by `name` (case-insensitive): posting
 * an existing name returns it (200) instead of creating a duplicate (201).
 */
export const createCompanyBodySchema = z.object({
  name: z.string().min(1),
  contact_emails: z.array(z.email()).optional(),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS).optional(),
})

export type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>

/**
 * `PATCH /api/companies/:id` — every field optional, only what's sent
 * changes. There is no delete: `{ active: false }` disables a company
 * without touching its data or any operation that references it.
 */
export const updateCompanyBodySchema = z.object({
  name: z.string().min(1).optional(),
  contact_emails: z.array(z.email()).optional(),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  active: z.boolean().optional(),
})

export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>

/** View-model validated by the create-company form — a single contact email
 * field, not the wire's `contact_emails` array. Both name and contact email
 * are required here, even though the wire schema keeps them optional for
 * other callers (e.g. the email-intake flow, which may not have an email). */
export function createCompanyFormSchema() {
  return z.object({
    name: validators.requiredString(),
    contactEmail: validators.email(),
    notificationChannel: z.enum(NOTIFICATION_CHANNELS),
  })
}

export type CompanyFormInput = z.infer<ReturnType<typeof createCompanyFormSchema>>

export const companyResponseSchema = z.object({
  id: idSchema,
  name: z.string(),
  contact_emails: z.array(z.string()),
  preferred_notification_channel: z.enum(NOTIFICATION_CHANNELS),
  active: z.boolean(),
})

export type Company = z.infer<typeof companyResponseSchema>

/** `GET /api/companies` responds `{ companies: [...] }` — unfiltered, unpaginated. */
export const companyListSchema = z.object({
  companies: z.array(companyResponseSchema),
})
