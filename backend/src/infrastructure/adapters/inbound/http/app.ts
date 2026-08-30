import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { healthHandler } from "./routes/health.routes.js";
import { type RouteDependencies, apiRoutes } from "./routes/index.js";

/**
 * Documents arrive as base64 inside JSON, and base64 inflates a file by a
 * third. Fastify's 1 MiB default rejected almost any real bill of lading, as a
 * 413 with no body the frontend cannot explain.
 */
const BODY_LIMIT_BYTES = 16 * 1024 * 1024;

export function buildApp(deps: RouteDependencies): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: BODY_LIMIT_BYTES });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      reply.code(400).send({
        error: "validation_error",
        message: "Request validation failed",
        details: error.validation,
      });
      return;
    }
    reply.send(error);
  });

  void app.register(cors, { origin: process.env.CORS_ORIGIN || false });

  app.get("/health", healthHandler);

  void app.register(apiRoutes, { prefix: "/api", ...deps });

  return app;
}
