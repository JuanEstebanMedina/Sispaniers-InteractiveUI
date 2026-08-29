import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  type FlowComponentsRouteDeps,
  flowComponentsRoutes,
} from "./dashboard/flow-components.routes.js";
import { type FlowsRouteDeps, flowsRoutes } from "./dashboard/flows.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps & FlowsRouteDeps & FlowComponentsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const {
    receiveEmail,
    sendEmail,
    createOperation,
    getOperation,
    listOperations,
    getOperationComponents,
    updateOperationLayout,
  } = deps;

  await fastify.register(emailsRoutes, { receiveEmail, sendEmail });
  await fastify.register(flowsRoutes, { createOperation, getOperation, listOperations });
  await fastify.register(flowComponentsRoutes, { getOperationComponents, updateOperationLayout });
};
