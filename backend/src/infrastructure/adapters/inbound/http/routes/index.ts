import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type AiRouteDeps, aiRoutes } from "./dashboard/ai.routes.js";
import {
  type OperationComponentsRouteDeps,
  operationComponentsRoutes,
} from "./dashboard/operation-components.routes.js";
import { type OperationsRouteDeps, operationsRoutes } from "./dashboard/operations.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps &
  OperationsRouteDeps &
  OperationComponentsRouteDeps &
  AiRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const {
    receiveEmail,
    sendEmail,
    createOperation,
    getOperation,
    listOperations,
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
    generateComponentFromAi,
    componentEventsBroadcaster,
    operationRepository,
  } = deps;

  await fastify.register(emailsRoutes, { receiveEmail, sendEmail });
  await fastify.register(operationsRoutes, { createOperation, getOperation, listOperations });
  await fastify.register(operationComponentsRoutes, {
    getOperationComponents,
    updateOperationLayout,
    updateComponentContent,
  });
  await fastify.register(aiRoutes, {
    generateComponentFromAi,
    componentEventsBroadcaster,
    operationRepository,
  });
};
