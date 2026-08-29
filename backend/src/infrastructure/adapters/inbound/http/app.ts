import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { healthHandler } from "./routes/health.routes.js";
import { type RouteDependencies, apiRoutes } from "./routes/index.js";

export function buildApp(deps: RouteDependencies): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

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

  void app.register(cors, { origin: true });

  app.get("/health", healthHandler);

  void app.register(apiRoutes, { prefix: "/api", ...deps });

  return app;
}
