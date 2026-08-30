import { z } from "zod";

import { componentResponseSchema } from "./operation-component.schema.js";

export const chatBodySchema = z.object({
  message: z.string().min(1),
});

export const chatResponseSchema = z.object({ reply: z.string() });

export const webhookBodySchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export const webhookResponseSchema = componentResponseSchema;
