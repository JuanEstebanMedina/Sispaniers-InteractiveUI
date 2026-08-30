import { z } from "zod";
import { ROLES } from "../../../../../domain/enums/role.js";

export const createUserBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(ROLES),
  company_id: z.string().optional(),
});

export const updateUserBodySchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

export const listUsersQuerySchema = z.object({
  company_id: z.string().optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  company_id: z.string().optional(),
  active: z.boolean(),
});

export const listUsersResponseSchema = z.object({
  users: z.array(userResponseSchema),
});
