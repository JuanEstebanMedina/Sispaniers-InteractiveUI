import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import type { ListedOperation } from "../../../../../application/use-cases/list-operations.use-case.js";
import { listOperationsResponseSchema } from "../schemas/operation.schema.js";

export interface OperationsRouteDeps {
  listOperations: () => Promise<ListedOperation[]>;
}

export const operationsRoutes: FastifyPluginAsyncZod<OperationsRouteDeps> = async (
  fastify,
  deps,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/operations",
    { schema: { response: { 200: listOperationsResponseSchema } } },
    async () => ({ operations: await deps.listOperations() }),
  );
};
