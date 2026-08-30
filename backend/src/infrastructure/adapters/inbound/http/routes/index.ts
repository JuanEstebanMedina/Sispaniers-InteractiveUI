import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type AiRouteDeps, aiRoutes } from "./dashboard/ai.routes.js";
import {
  type OperationComponentsRouteDeps,
  operationComponentsRoutes,
} from "./dashboard/operation-components.routes.js";
import {
  type OperationEventsRouteDeps,
  operationEventsRoutes,
} from "./dashboard/operation-events.routes.js";
import { type OperationsRouteDeps, operationsRoutes } from "./dashboard/operations.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps &
  OperationsRouteDeps &
  OperationComponentsRouteDeps &
  AiRouteDeps &
  OperationEventsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const {
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    createOperation,
    getOperation,
    listOperations,
    getDocumentPreviewUrl,
    uploadOperationDocument,
    applyTrackingEvent,
    enrollOperationInSimulation,
    getOperationComponents,
    updateComponentPlacement,
    updateComponentContent,
    generateComponentFromAi,
    respondToChat,
    createComponent,
    deleteComponent,
    componentEventPublisher,
    operationEventPublisher,
  } = deps;

  await fastify.register(emailsRoutes, {
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    enrollOperationInSimulation,
  });
  await fastify.register(operationsRoutes, {
    createOperation,
    getOperation,
    listOperations,
    getDocumentPreviewUrl,
    uploadOperationDocument,
    applyTrackingEvent,
    enrollOperationInSimulation,
  });
  await fastify.register(operationComponentsRoutes, {
    getOperationComponents,
    updateComponentPlacement,
    updateComponentContent,
    createComponent,
    deleteComponent,
  });
  await fastify.register(aiRoutes, { generateComponentFromAi, respondToChat });
  await fastify.register(operationEventsRoutes, {
    componentEventPublisher,
    operationEventPublisher,
  });
};
