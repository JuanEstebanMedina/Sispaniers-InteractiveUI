import { z } from 'zod'

import { ROLES } from '@/auth/roles'
import { idSchema, isoDateSchema, validators } from './common.schema'

export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string().min(1),

  role: z
    .string()
    .transform((value) => value.toLowerCase().trim().replace(/^role_/, ''))
    .pipe(z.enum(ROLES)),

  avatarUrl: z.string().nullish(),

  companyId: idSchema.nullish(),
  active: z.boolean().optional().default(true),

  createdAt: isoDateSchema.nullish(),
  lastLoginAt: isoDateSchema.nullish(),
})

export type User = z.infer<typeof userSchema>

export const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().nullish(),
  expiresIn: z.number().nullish(),
})

export type TokenPair = z.infer<typeof tokenPairSchema>

export const loginResponseSchema = tokenPairSchema.extend({
  user: userSchema,
})

export type LoginResponse = z.infer<typeof loginResponseSchema>

export function createLoginSchema() {
  return z.object({
    email: validators.email(),
    password: validators.password(6),
    remember: z.boolean(),
  })
}

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
