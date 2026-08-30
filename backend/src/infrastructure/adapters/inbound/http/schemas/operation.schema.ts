import { z } from "zod";
import { CONTAINER_STATES } from "../../../../../domain/enums/container-state.js";
import { DOCUMENT_FORMATS } from "../../../../../domain/enums/document-format.js";
import { DOCUMENT_TYPES } from "../../../../../domain/enums/document-type.js";
import { OPERATION_HEALTH_STATES } from "../../../../../domain/enums/operation-health.js";

export const createOperationBodySchema = z.object({
  company_id: z.string().min(1),
  health: z.enum(OPERATION_HEALTH_STATES).optional(),
});

export type CreateOperationBody = z.infer<typeof createOperationBodySchema>;

export const operationResponseSchema = z.object({
  id: z.string(),
  company_ids: z.array(z.string()),
  status: z.enum(CONTAINER_STATES),
  health: z.enum(OPERATION_HEALTH_STATES),
  created_at: z.string(),
  bookings: z.array(z.unknown()),
  context: z.object({
    emails: z.array(z.unknown()),
    documents: z.array(z.unknown()),
  }),
});

export const listOperationsQuerySchema = z.object({
  status: z.enum(CONTAINER_STATES).optional(),
  health: z.enum(OPERATION_HEALTH_STATES).optional(),
  company_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
});

export type ListOperationsQuery = z.infer<typeof listOperationsQuerySchema>;

export const listOperationsResponseSchema = z.object({
  operations: z.array(operationResponseSchema),
});

export const documentPreviewUrlResponseSchema = z.object({
  url: z.string(),
  expires_in_seconds: z.number(),
});

export const uploadDocumentBodySchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().min(1),
  data: z.string().min(1),
  type: z.enum(DOCUMENT_TYPES).optional(),
});

export const documentResponseSchema = z.object({
  id: z.string(),
  type: z.enum(DOCUMENT_TYPES),
  format: z.enum(DOCUMENT_FORMATS),
  bucket_key: z.string(),
  booking_id: z.string().optional(),
  source_email_id: z.string().optional(),
  extracted_data: z.record(z.string(), z.unknown()),
  received_at: z.string(),
});

export const uploadDocumentResponseSchema = z.object({
  document: documentResponseSchema,
  url: z.string(),
  expires_in_seconds: z.number(),
});
