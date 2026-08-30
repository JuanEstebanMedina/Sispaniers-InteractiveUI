import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { deriveOperationStatus } from "../../../../../../domain/logistics/operation-status.js";
import type { ComponentEventPublisher } from "../../../../../../domain/ports/component-event-publisher.port.js";
import type { OperationEventPublisher } from "../../../../../../domain/ports/operation-event-publisher.port.js";
import { toComponentWireShape } from "../../mappers/component.mapper.js";
import { toOperationResponse } from "./operations.routes.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface OperationEventsRouteDeps {
  componentEventPublisher: ComponentEventPublisher;
  operationEventPublisher: OperationEventPublisher;
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

      const unsubscribeComponents = deps.componentEventPublisher.subscribe(
        id,
        (event, component) => {
          reply.raw.write(
            `event: ${event}\ndata: ${JSON.stringify(toComponentWireShape(component))}\n\n`,
          );
        },
      );

      const unsubscribeOperations = deps.operationEventPublisher.subscribe(
        id,
        (event, operation) => {
          const wireShape = toOperationResponse(operation, deriveOperationStatus(operation));
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(wireShape)}\n\n`);

          // The simulator ran out of steps for this operation — nothing more
          // will ever be published for it, so close the stream instead of
          // leaving the client waiting on a connection that stays silent forever.
          if (event === "simulation-completed") {
            unsubscribeComponents();
            unsubscribeOperations();
            reply.raw.end();
          }
        },
      );

      request.raw.on("close", () => {
        unsubscribeComponents();
        unsubscribeOperations();
        reply.raw.end();
      });
    },
  );
};
