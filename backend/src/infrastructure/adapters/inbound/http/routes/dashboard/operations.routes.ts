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
  listOperationsResponseSchema,
  operationResponseSchema,
  searchOperationsBodySchema,
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
    company_ids: [...new Set(operation.bookings.flatMap((booking) => booking.companyIds))],
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
};
