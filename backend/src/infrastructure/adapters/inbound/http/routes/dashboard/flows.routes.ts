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
  InvalidFilterCombinationError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  createFlowBodySchema,
  flowResponseSchema,
  listFlowsQuerySchema,
  listFlowsResponseSchema,
} from "../../schemas/flow.schema.js";

const flowParamsSchema = z.object({ id: z.string().min(1) });

export interface FlowsRouteDeps {
  createOperation: (input: CreateOperationInput) => Promise<CreateOperationResult>;
  getOperation: (input: GetOperationInput) => Promise<GetOperationResult>;
  listOperations: (input: ListOperationsInput) => Promise<ListOperationsResultItem[]>;
}

function toFlowResponse(operation: Operation, status: ContainerState) {
  return {
    id: operation.id,
    client_id: operation.clientId,
    status,
    health: operation.health ?? "ok",
    created_at: operation.createdAt.toISOString(),
    bookings: operation.bookings,
    documents: operation.documents,
  } as const;
}

export const flowsRoutes: FastifyPluginAsyncZod<FlowsRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/flows",
    {
      schema: {
        body: createFlowBodySchema,
        response: { 201: flowResponseSchema },
      },
    },
    async (request, reply) => {
      const dto = request.body;

      const result = await deps.createOperation({
        clientId: dto.client_id,
        ...(dto.health !== undefined ? { health: dto.health } : {}),
      });

      reply.code(201).send(toFlowResponse(result.operation, result.status));
    },
  );

  app.get(
    "/flows/:id",
    {
      schema: {
        params: flowParamsSchema,
        response: { 200: flowResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const result = await deps.getOperation({ id });
        reply.code(200).send(toFlowResponse(result.operation, result.status));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "flow_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.get(
    "/flows",
    {
      schema: {
        querystring: listFlowsQuerySchema,
        response: { 200: listFlowsResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const query = request.query;

      try {
        const results = await deps.listOperations({
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.health !== undefined ? { health: query.health } : {}),
          ...(query.search !== undefined ? { search: query.search } : {}),
          ...(query.from !== undefined ? { from: new Date(query.from) } : {}),
          ...(query.to !== undefined ? { to: new Date(query.to) } : {}),
          ...(query.date !== undefined ? { date: new Date(query.date) } : {}),
        });

        reply.code(200).send({
          flows: results.map(({ operation, status }) => toFlowResponse(operation, status)),
        });
      } catch (error) {
        if (error instanceof InvalidFilterCombinationError) {
          reply.code(400).send({ error: "invalid_filter_combination", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
