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
 * 16 MB, matching `client_max_body_size` in the frontend's nginx.
 *
 * Fastify defaults to 1 MB, which is fine for JSON and far too small for a
 * document upload: the file travels base64-encoded, so an 8 MB PDF arrives as
 * roughly 10.7 MB. The two limits have to agree, or the request dies at
 * whichever is lower — and nginx letting a body through only for Fastify to
 * reject it wastes the entire upload.
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

  // Set CORS_ORIGIN=* for open demo access. Unset means same-origin only.
  void app.register(cors, { origin: process.env.CORS_ORIGIN || false });

  app.get("/health", healthHandler);

  void app.register(apiRoutes, { prefix: "/api", ...deps });

  return app;
}
