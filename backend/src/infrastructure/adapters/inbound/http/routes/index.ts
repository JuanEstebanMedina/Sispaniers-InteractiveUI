import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { type EmailsRouteDeps, emailsRoutes } from "./emails.routes.js";

export type RouteDependencies = EmailsRouteDeps;

export const apiRoutes: FastifyPluginAsyncZod<RouteDependencies> = async (fastify, deps) => {
  const { receiveEmail, sendEmail } = deps;

  await fastify.register(emailsRoutes, { receiveEmail, sendEmail });
};
