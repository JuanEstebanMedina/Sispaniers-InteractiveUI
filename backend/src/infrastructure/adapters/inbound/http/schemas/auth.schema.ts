import { z } from "zod";
import { ROLES } from "../../../../../domain/enums/role.js";

export const loginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const authUserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  companyId: z.string().optional(),
  active: z.boolean(),
});

export const tokenPairResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const loginResponseSchema = tokenPairResponseSchema.extend({
  user: authUserResponseSchema,
});
