import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
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
    updateOperationLayout,
    updateComponentContent,
    createComponent,
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
    updateOperationLayout,
    updateComponentContent,
    createComponent,
  });
  await fastify.register(operationEventsRoutes, {
    componentEventPublisher,
    operationEventPublisher,
  });
};
