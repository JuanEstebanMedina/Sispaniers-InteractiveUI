import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";
import { type OperationsRouteDeps, operationsRoutes } from "./operations.routes.js";

export type RouteDependencies = EmailsRouteDeps & OperationsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const { sendEmail, listOperations } = deps;

  await fastify.register(emailsRoutes, { sendEmail });
  await fastify.register(operationsRoutes, { listOperations });
};
