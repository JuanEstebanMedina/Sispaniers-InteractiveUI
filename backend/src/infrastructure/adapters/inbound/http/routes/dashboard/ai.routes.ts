import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { GenerateComponentFromAiInput } from "../../../../../../application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import type { Component } from "../../../../../../domain/components/component.js";
import {
  InvalidAiComponentError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import type { ComponentEventsBroadcaster } from "../../../../../../domain/ports/component-events.port.js";
import type { OperationRepository } from "../../../../../../domain/ports/operation.repository.js";
import {
  chatBodySchema,
  chatResponseSchema,
  webhookBodySchema,
  webhookResponseSchema,
} from "../../schemas/ai.schema.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface AiRouteDeps {
  generateComponentFromAi: (input: GenerateComponentFromAiInput) => Promise<Component>;
  componentEventsBroadcaster: ComponentEventsBroadcaster;
  operationRepository: OperationRepository;
}

function toComponentResponse(component: Component) {
  return {
    id: component.id,
    operation_id: component.operationId,
    kind: component.kind,
    content: component.content,
    size: component.size,
    created_at: component.createdAt.toISOString(),
  } as const;
}

export const aiRoutes: FastifyPluginAsyncZod<AiRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/operations/:id/chat",
    {
      schema: {
        params: operationParamsSchema,
        body: chatBodySchema,
        response: {
          201: chatResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { message } = request.body;

      try {
        const component = await deps.generateComponentFromAi({
          operationId: id,
          trigger: "chat",
          input: message,
        });
        reply.code(201).send(toComponentResponse(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidAiComponentError) {
          reply.code(502).send({ error: "invalid_ai_component", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.post(
    "/operations/:id/webhook",
    {
      schema: {
        params: operationParamsSchema,
        body: webhookBodySchema,
        response: {
          202: webhookResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema,
        },
      },
    },
    // ponytail: no HMAC/shared-secret verification on this endpoint. Add it
    // before this touches a real external webhook source.
    async (request, reply) => {
      const { id } = request.params;
      const { event, payload } = request.body;

      try {
        const component = await deps.generateComponentFromAi({
          operationId: id,
          trigger: "auto",
          input: JSON.stringify({ event, payload }),
        });
        reply.code(202).send(toComponentResponse(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidAiComponentError) {
          reply.code(502).send({ error: "invalid_ai_component", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.get(
    "/operations/:id/events",
    { schema: { params: operationParamsSchema } },
    async (request, reply) => {
      const { id } = request.params;

      const operation = await deps.operationRepository.findById(id);
      if (operation === null) {
        reply
          .code(404)
          .send({ error: "operation_not_found", message: `Operation not found: ${id}` });
        return;
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      reply.raw.write(": connected\n\n");

      // ponytail: no periodic keep-alive ping. Add one if a proxy in front of
      // this starts timing out idle SSE connections.
      const unsubscribe = deps.componentEventsBroadcaster.subscribe(id, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      request.raw.on("close", () => {
        unsubscribe();
        reply.raw.end();
      });
    },
  );
};
