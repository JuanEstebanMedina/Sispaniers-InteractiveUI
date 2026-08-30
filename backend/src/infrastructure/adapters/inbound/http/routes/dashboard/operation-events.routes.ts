import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  GetOperationInput,
  GetOperationResult,
} from "../../../../../../application/use-cases/dashboard/get-operation.use-case.js";
import type { Component } from "../../../../../../domain/components/component.js";
import { deriveOperationStatus } from "../../../../../../domain/logistics/operation-status.js";
import { OperationNotFoundError } from "../../../../../../domain/model/errors.js";
import type { ComponentEventPublisher } from "../../../../../../domain/ports/component-event-publisher.port.js";
import type { OperationEventPublisher } from "../../../../../../domain/ports/operation-event-publisher.port.js";
import { toComponentWireShape } from "../../mappers/component.mapper.js";
import { writeSseHead } from "../../sse.js";
import { toOperationResponse } from "./operations.routes.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface OperationEventsRouteDeps {
  componentEventPublisher: ComponentEventPublisher;
  operationEventPublisher: OperationEventPublisher;
  getOperation: (input: GetOperationInput) => Promise<GetOperationResult>;
}

export const operationEventsRoutes: FastifyPluginAsyncZod<OperationEventsRouteDeps> = async (
  fastify,
  deps,
) => {
  fastify.get("/operations/events", (request, reply) => {
    writeSseHead(reply);

    const unsubscribe = deps.operationEventPublisher.subscribeAll((event, operation) => {
      const companyId = request.actor.companyId;
      if (
        request.actor.role !== "superadmin" &&
        (companyId === undefined ||
          (operation.companyId !== companyId &&
            !operation.bookings.some((booking) => booking.companyIds.includes(companyId))))
      ) {
        return;
      }

      const wireShape = toOperationResponse(operation, deriveOperationStatus(operation));
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(wireShape)}\n\n`);
    });

    request.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });

  fastify.get(
    "/operations/:id/events",
    { schema: { params: operationParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;

      try {
        await deps.getOperation({
          id,
          ...(request.actor.role !== "superadmin" && request.actor.companyId !== undefined
            ? { requesterCompanyId: request.actor.companyId }
            : {}),
        });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          return reply.code(404).send({ error: "operation_not_found", message: error.message });
        }
        throw error;
      }

      writeSseHead(reply);

      const unsubscribeComponents = deps.componentEventPublisher.subscribe(id, (event, payload) => {
        // "component-pending" carries its own wire shape already — it has
        // no Component to map, just the estimated size and a temp id.
        // "component-pending-cleared" carries no payload at all.
        const data =
          event === "component-pending" || event === "component-pending-cleared"
            ? payload
            : toComponentWireShape(payload as Component);
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      });

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
