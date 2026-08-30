import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { AuthTokenPort } from "../../../../../domain/ports/auth-token.port.js";
import { createAuthenticateHook } from "../auth-hook.js";
import {
  type AuthMeRouteDeps,
  type AuthRouteDeps,
  authMeRoutes,
  authRoutes,
} from "./auth.routes.js";
import { type AiRouteDeps, aiRoutes } from "./dashboard/ai.routes.js";
import { type CompaniesRouteDeps, companiesRoutes } from "./dashboard/companies.routes.js";
import {
  type OperationComponentsRouteDeps,
  operationComponentsRoutes,
} from "./dashboard/operation-components.routes.js";
import {
  type OperationEventsRouteDeps,
  operationEventsRoutes,
} from "./dashboard/operation-events.routes.js";
import { type OperationsRouteDeps, operationsRoutes } from "./dashboard/operations.routes.js";
import { type UsersRouteDeps, usersRoutes } from "./dashboard/users.routes.js";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps &
  OperationsRouteDeps &
  OperationComponentsRouteDeps &
  AiRouteDeps &
  OperationEventsRouteDeps &
  CompaniesRouteDeps &
  AuthRouteDeps &
  AuthMeRouteDeps &
  UsersRouteDeps & {
    authTokenPort: AuthTokenPort;
  };

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
    createComponent,
    deleteComponent,
    componentEventPublisher,
    operationEventPublisher,
    createCompany,
    listCompanies,
    updateCompany,
    login,
    refreshToken,
    getMe,
    createUser,
    listUsers,
    updateUser,
    authTokenPort,
  } = deps;

  await fastify.register(authRoutes, { login, refreshToken });
  await fastify.register(emailsRoutes, {
    receiveEmail,
    sendEmail,
    upsertOperationFromEmail,
    enrollOperationInSimulation,
  });
  // Nested plugin: registering the auth hook inside a child context (instead
  // of directly on `fastify`) keeps it from leaking backward onto the
  // already-registered, unauthenticated `authRoutes` above — Fastify's hook
  // encapsulation is scoped to the instance a plugin is registered on, not to
  // call order on a shared instance.
  await fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook(
      "preHandler",
      createAuthenticateHook(authTokenPort.verifyAccessToken.bind(authTokenPort)),
    );

    await protectedRoutes.register(companiesRoutes, {
      createCompany,
      listCompanies,
      updateCompany,
    });
    await protectedRoutes.register(operationsRoutes, {
      createOperation,
      getOperation,
      listOperations,
      getDocumentPreviewUrl,
      uploadOperationDocument,
      applyTrackingEvent,
      enrollOperationInSimulation,
    });
    await protectedRoutes.register(operationComponentsRoutes, {
      getOperationComponents,
      updateComponentPlacement,
      updateComponentContent,
      createComponent,
      deleteComponent,
    });
    await protectedRoutes.register(aiRoutes, { generateComponentFromAi });
    await protectedRoutes.register(operationEventsRoutes, {
      componentEventPublisher,
      operationEventPublisher,
      getOperation,
    });
    await protectedRoutes.register(usersRoutes, { createUser, listUsers, updateUser });
    await protectedRoutes.register(authMeRoutes, { getMe });
  });
};
