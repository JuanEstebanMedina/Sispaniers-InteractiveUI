import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { GenerateComponentFromAiInput } from "../../../../../../application/use-cases/dashboard/generate-component-from-ai.use-case.js";
import type { Component } from "../../../../../../domain/components/component.js";
import {
  AiCompletionError,
  InvalidAiComponentError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { toComponentWireShape } from "../../mappers/component.mapper.js";
import {
  chatBodySchema,
  chatResponseSchema,
  webhookBodySchema,
  webhookResponseSchema,
} from "../../schemas/ai.schema.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });

export interface AiRouteDeps {
  generateComponentFromAi: (
    input: GenerateComponentFromAiInput,
  ) => Promise<{ component: Component | null; reply: string }>;
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
      const { message, componentIds } = request.body;

      try {
        const result = await deps.generateComponentFromAi({
          operationId: id,
          trigger: "chat",
          input: message,
          referencedComponentIds: componentIds ?? [],
        });
        reply.code(201).send({ reply: result.reply, component_created: result.component !== null });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidAiComponentError) {
          reply.code(502).send({ error: "invalid_ai_component", message: error.message });
          return;
        }
        if (error instanceof AiCompletionError) {
          reply.code(502).send({ error: "ai_service_unavailable", message: error.message });
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
        const { component } = await deps.generateComponentFromAi({
          operationId: id,
          trigger: "auto",
          input: JSON.stringify({ event, payload }),
        });
        if (component === null) {
          throw new InvalidAiComponentError("auto trigger resolved without a component");
        }
        reply.code(202).send(toComponentWireShape(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidAiComponentError) {
          reply.code(502).send({ error: "invalid_ai_component", message: error.message });
          return;
        }
        if (error instanceof AiCompletionError) {
          reply.code(502).send({ error: "ai_service_unavailable", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
