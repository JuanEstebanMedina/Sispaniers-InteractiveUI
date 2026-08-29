import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type FlowsRouteDeps, flowsRoutes } from "./dashboard/flows.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps & FlowsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const { sendEmail, createOperation, getOperation, listOperations } = deps;

  await fastify.register(emailsRoutes, { sendEmail });
  await fastify.register(flowsRoutes, { createOperation, getOperation, listOperations });
};
