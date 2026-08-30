import { z } from 'zod'

import { ROLES } from '@/auth/roles'
import { idSchema, validators } from './common.schema'

/**
 * `/users` responses use snake_case `company_id` — a different wire schema
 * from `/auth/*`'s camelCase `companyId` on `userSchema`. Match each one
 * exactly as the backend sends it, don't unify them.
 */
export const managedUserSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  company_id: idSchema.nullish(),
  active: z.boolean(),
})

export type ManagedUser = z.infer<typeof managedUserSchema>

/** `GET /users` responds `{ users: [...] }`. */
export const userListSchema = z.object({
  users: z.array(managedUserSchema),
})

export const userResponseSchema = managedUserSchema

/** `POST /users` body. */
export interface CreateUserBody {
  email: string
  password: string
  name: string
  role: (typeof ROLES)[number]
  company_id?: string
}

/** `PATCH /users/:id` body — every field optional, only what's sent changes. */
export interface UpdateUserBody {
  name?: string
  role?: (typeof ROLES)[number]
  active?: boolean
  password?: string
}

/**
 * View-model validated by both the create- and edit-user forms. Matches the
 * form's own field names (`companyId`, not the wire's `company_id`).
 *
 * The password is always optional here — blank means "leave the current
 * password unchanged" when editing. Requiring it on create is a separate,
 * imperative check in the submit handler, because a single `useForm` call
 * needs one static validator type shared by both modes.
 */
export function userFormSchema() {
  return z.object({
    name: validators.requiredString(),
    email: validators.email(),
    password: z.union([z.literal(''), validators.password(6)]),
    role: z.enum(ROLES),
    companyId: z.string(),
  })
}

export type UserFormInput = z.infer<ReturnType<typeof userFormSchema>>
