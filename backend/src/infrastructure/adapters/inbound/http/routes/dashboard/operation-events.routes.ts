import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ComponentEventPublisher } from "../../../../../../domain/ports/component-event-publisher.port.js";
import { toComponentWireShape } from "../../mappers/component.mapper.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface OperationEventsRouteDeps {
  componentEventPublisher: ComponentEventPublisher;
}

export const operationEventsRoutes: FastifyPluginAsyncZod<OperationEventsRouteDeps> = async (
  fastify,
  deps,
) => {
  fastify.get(
    "/operations/:id/events",
    { schema: { params: operationParamsSchema } },
    (request, reply) => {
      const { id } = request.params;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const unsubscribe = deps.componentEventPublisher.subscribe(id, (event, component) => {
        reply.raw.write(
          `event: ${event}\ndata: ${JSON.stringify(toComponentWireShape(component))}\n\n`,
        );
      });

      request.raw.on("close", () => {
        unsubscribe();
        reply.raw.end();
      });
    },
  );
};
