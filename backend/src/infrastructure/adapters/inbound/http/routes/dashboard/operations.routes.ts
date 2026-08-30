import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ApplyTrackingEventInput } from "../../../../../../application/use-cases/dashboard/apply-tracking-event.use-case.js";
import type {
  CreateOperationInput,
  CreateOperationResult,
} from "../../../../../../application/use-cases/dashboard/create-operation.use-case.js";
import type { EnrollOperationInSimulationInput } from "../../../../../../application/use-cases/dashboard/enroll-operation-in-simulation.use-case.js";
import type {
  GetDocumentPreviewUrlInput,
  GetDocumentPreviewUrlResult,
} from "../../../../../../application/use-cases/dashboard/get-document-preview-url.use-case.js";
import type {
  GetOperationInput,
  GetOperationResult,
} from "../../../../../../application/use-cases/dashboard/get-operation.use-case.js";
import type {
  ListOperationsInput,
  ListOperationsResultItem,
} from "../../../../../../application/use-cases/dashboard/list-operations.use-case.js";
import type {
  UploadOperationDocumentInput,
  UploadOperationDocumentResult,
} from "../../../../../../application/use-cases/dashboard/upload-operation-document.use-case.js";
import type { ContainerState } from "../../../../../../domain/enums/container-state.js";
import type { Document } from "../../../../../../domain/logistics/document.js";
import { deriveOperationStatus } from "../../../../../../domain/logistics/operation-status.js";
import type { Operation } from "../../../../../../domain/logistics/operation.js";
import {
  BookingNotFoundError,
  CompanyNotFoundError,
  ContainerNotFoundError,
  DocumentNotFoundError,
  DocumentUploadError,
  InvalidFilterCombinationError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  createOperationBodySchema,
  documentPreviewUrlResponseSchema,
  listOperationsResponseSchema,
  operationResponseSchema,
  searchOperationsBodySchema,
  trackingEventBodySchema,
  uploadDocumentBodySchema,
  uploadDocumentResponseSchema,
} from "../../schemas/operation.schema.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });
const documentParamsSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
});

export interface OperationsRouteDeps {
  createOperation: (input: CreateOperationInput) => Promise<CreateOperationResult>;
  getOperation: (input: GetOperationInput) => Promise<GetOperationResult>;
  listOperations: (input: ListOperationsInput) => Promise<ListOperationsResultItem[]>;
  getDocumentPreviewUrl: (
    input: GetDocumentPreviewUrlInput,
  ) => Promise<GetDocumentPreviewUrlResult>;
  uploadOperationDocument: (
    input: UploadOperationDocumentInput,
  ) => Promise<UploadOperationDocumentResult>;
  applyTrackingEvent: (input: ApplyTrackingEventInput) => Promise<Operation>;
  enrollOperationInSimulation: (input: EnrollOperationInSimulationInput) => Promise<void>;
}

export function toOperationResponse(operation: Operation, status: ContainerState) {
  return {
    id: operation.id,
    company_ids: [...new Set(operation.bookings.flatMap((booking) => booking.companyIds))],
    status,
    health: operation.health ?? "ok",
    created_at: operation.createdAt.toISOString(),
    bookings: operation.bookings,
    context: operation.context,
  };
}

function toDocumentResponse(document: Document) {
  return {
    id: document.id,
    type: document.type,
    format: document.format,
    bucket_key: document.bucketKey,
    ...(document.bookingId !== undefined ? { booking_id: document.bookingId } : {}),
    ...(document.sourceEmailId !== undefined ? { source_email_id: document.sourceEmailId } : {}),
    extracted_data: document.extractedData,
    received_at: document.receivedAt.toISOString(),
  };
}

export const operationsRoutes: FastifyPluginAsyncZod<OperationsRouteDeps> = async (
  fastify,
  deps,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/operations",
    {
      schema: {
        body: createOperationBodySchema,
        response: { 201: operationResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const dto = request.body;

      try {
        const result = await deps.createOperation({
          companyId: dto.company_id,
          ...(dto.health !== undefined ? { health: dto.health } : {}),
        });

        await deps.enrollOperationInSimulation({
          operationId: result.operation.id,
          companyId: dto.company_id,
        });

        reply.code(201).send(toOperationResponse(result.operation, result.status));
      } catch (error) {
        if (error instanceof CompanyNotFoundError) {
          reply.code(404).send({ error: "company_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.get(
    "/operations/:id",
    {
      schema: {
        params: operationParamsSchema,
        response: { 200: operationResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const result = await deps.getOperation({ id });
        reply.code(200).send(toOperationResponse(result.operation, result.status));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  /**
   * `POST /operations/search` — el ÚNICO listado.
   *
   * Había también un `GET /operations` y se eliminó: dos rutas para lo mismo
   * significan dos contratos que mantener y dos sitios donde arreglar un bug
   * de filtrado. Los filtros de la web —texto libre, estado, salud, empresa,
   * rango de fechas y orden— no caben en una query string legible, así que la
   * que sobrevive es la que puede con todo.
   *
   * Un body vacío lista todo, que es lo que el GET hacía.
   */
  app.post(
    "/operations/search",
    {
      schema: {
        body: searchOperationsBodySchema,
        response: {
          200: listOperationsResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;

      try {
        const results = await deps.listOperations({
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.health !== undefined ? { health: body.health } : {}),
          ...(body.company_id !== undefined ? { companyId: body.company_id } : {}),
          ...(body.search !== undefined ? { search: body.search } : {}),
          ...(body.from !== undefined ? { from: new Date(body.from) } : {}),
          ...(body.to !== undefined ? { to: new Date(body.to) } : {}),
          ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
          ...(body.sort_by !== undefined ? { sortBy: body.sort_by } : {}),
          ...(body.sort_dir !== undefined ? { sortDir: body.sort_dir } : {}),
        });

        reply.code(200).send({
          operations: results.map(({ operation, status }) =>
            toOperationResponse(operation, status),
          ),
        });
      } catch (error) {
        if (error instanceof InvalidFilterCombinationError) {
          reply.code(400).send({ error: "invalid_filter_combination", message: error.message });
          return;
        }
        if (error instanceof CompanyNotFoundError) {
          reply.code(404).send({ error: "company_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.get(
    "/operations/:id/documents/:documentId/preview-url",
    {
      schema: {
        params: documentParamsSchema,
        response: { 200: documentPreviewUrlResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id, documentId } = request.params;

      try {
        const result = await deps.getDocumentPreviewUrl({ operationId: id, documentId });
        reply.code(200).send({ url: result.url, expires_in_seconds: result.expiresInSeconds });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof DocumentNotFoundError) {
          reply.code(404).send({ error: "document_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  // TODO: protect this endpoint with a shared secret/auth before production
  app.post(
    "/operations/:id/documents",
    {
      schema: {
        params: operationParamsSchema,
        body: uploadDocumentBodySchema,
        response: {
          201: uploadDocumentResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const dto = request.body;

      try {
        const result = await deps.uploadOperationDocument({
          operationId: id,
          filename: dto.filename,
          mimetype: dto.mimetype,
          data: dto.data,
          ...(dto.type !== undefined ? { type: dto.type } : {}),
        });

        reply.code(201).send({
          document: toDocumentResponse(result.document),
          url: result.url,
          expires_in_seconds: result.expiresInSeconds,
        });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof DocumentUploadError) {
          reply.code(502).send({ error: "document_upload_failed", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  // Manual override for the automatic simulator (see run-simulation-tick.use-case.ts)
  // — force a specific tracking event on demand, e.g. during a live demo.
  app.post(
    "/operations/:id/tracking-events",
    {
      schema: {
        params: operationParamsSchema,
        body: trackingEventBodySchema,
        response: { 200: operationResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const dto = request.body;

      try {
        const operation = await deps.applyTrackingEvent({
          operationId: id,
          event:
            dto.type === "vessel_position"
              ? { type: "vessel_position", bookingId: dto.booking_id, lat: dto.lat, lng: dto.lng }
              : dto.type === "schedule_change"
                ? {
                    type: "schedule_change",
                    bookingId: dto.booking_id,
                    newEta: new Date(dto.new_eta),
                    reason: dto.reason,
                  }
                : {
                    type: "container_state",
                    bookingId: dto.booking_id,
                    containerId: dto.container_id,
                    state: dto.state,
                  },
        });

        reply.code(200).send(toOperationResponse(operation, deriveOperationStatus(operation)));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof BookingNotFoundError) {
          reply.code(404).send({ error: "booking_not_found", message: error.message });
          return;
        }
        if (error instanceof ContainerNotFoundError) {
          reply.code(404).send({ error: "container_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
