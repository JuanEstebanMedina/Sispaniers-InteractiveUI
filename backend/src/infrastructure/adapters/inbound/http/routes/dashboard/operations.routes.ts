import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  CreateOperationInput,
  CreateOperationResult,
} from "../../../../../../application/use-cases/dashboard/create-operation.use-case.js";
import type {
  GetOperationInput,
  GetOperationResult,
} from "../../../../../../application/use-cases/dashboard/get-operation.use-case.js";
import type {
  ListOperationsInput,
  ListOperationsResultItem,
} from "../../../../../../application/use-cases/dashboard/list-operations.use-case.js";
import type { ContainerState } from "../../../../../../domain/enums/container-state.js";
import type { Operation } from "../../../../../../domain/logistics/operation.js";
import {
  CompanyNotFoundError,
  InvalidFilterCombinationError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  createOperationBodySchema,
  listOperationsQuerySchema,
  listOperationsResponseSchema,
  operationResponseSchema,
} from "../../schemas/operation.schema.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface OperationsRouteDeps {
  createOperation: (input: CreateOperationInput) => Promise<CreateOperationResult>;
  getOperation: (input: GetOperationInput) => Promise<GetOperationResult>;
  listOperations: (input: ListOperationsInput) => Promise<ListOperationsResultItem[]>;
}

function toOperationResponse(operation: Operation, status: ContainerState) {
  return {
    id: operation.id,
    company_ids: [
      ...new Set([
        ...(operation.companyId !== undefined ? [operation.companyId] : []),
        ...operation.bookings.flatMap((booking) => booking.companyIds),
      ]),
    ],
    status,
    health: operation.health ?? "ok",
    created_at: operation.createdAt.toISOString(),
    bookings: operation.bookings,
    context: operation.context,
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

  app.get(
    "/operations",
    {
      schema: {
        querystring: listOperationsQuerySchema,
        response: {
          200: listOperationsResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query;

      try {
        const results = await deps.listOperations({
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.health !== undefined ? { health: query.health } : {}),
          ...(query.company_id !== undefined ? { companyId: query.company_id } : {}),
          ...(query.from !== undefined ? { from: new Date(query.from) } : {}),
          ...(query.to !== undefined ? { to: new Date(query.to) } : {}),
          ...(query.date !== undefined ? { date: new Date(query.date) } : {}),
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
};
