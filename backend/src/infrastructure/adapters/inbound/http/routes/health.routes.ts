import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

export function healthHandler(): { status: "ok" } {
  return { status: "ok" };
}

export const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get("/health", healthHandler);
};
