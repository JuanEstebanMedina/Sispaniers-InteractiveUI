import { z } from "zod";

import { componentResponseSchema } from "./operation-component.schema.js";

const MAX_REFERENCED_COMPONENTS = 3;

export const chatBodySchema = z.object({
  message: z.string().min(1),
  componentIds: z.array(z.string().min(1)).max(MAX_REFERENCED_COMPONENTS).optional(),
});

export const chatResponseSchema = z.object({ reply: z.string() });

export const webhookBodySchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

export const webhookResponseSchema = componentResponseSchema;
