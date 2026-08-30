import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  type OperationComponentsRouteDeps,
  operationComponentsRoutes,
} from "./dashboard/operation-components.routes.js";
import { type OperationsRouteDeps, operationsRoutes } from "./dashboard/operations.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps &
  OperationsRouteDeps &
  OperationComponentsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const {
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    createOperation,
    getOperation,
    listOperations,
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
    deleteComponent,
  } = deps;

  await fastify.register(emailsRoutes, { receiveEmail, sendEmail, upsertOperationFromEmail });
  await fastify.register(operationsRoutes, { createOperation, getOperation, listOperations });
  await fastify.register(operationComponentsRoutes, {
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
    deleteComponent,
  });
};
