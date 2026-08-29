import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  GetOperationComponentsInput,
  GetOperationComponentsResult,
} from "../../../../../../application/use-cases/dashboard/get-operation-components.use-case.js";
import type {
  UpdateOperationLayoutInput,
  UpdateOperationLayoutResult,
} from "../../../../../../application/use-cases/dashboard/update-operation-layout.use-case.js";
import type { Component } from "../../../../../../domain/components/component.js";
import type { LayoutEntry } from "../../../../../../domain/components/layout.js";
import {
  InvalidLayoutError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  getComponentsQuerySchema,
  getComponentsResponseSchema,
  updateLayoutBodySchema,
  updateLayoutResponseSchema,
} from "../../schemas/flow-component.schema.js";

const flowParamsSchema = z.object({ id: z.string().min(1) });

export interface FlowComponentsRouteDeps {
  getOperationComponents: (
    input: GetOperationComponentsInput,
  ) => Promise<GetOperationComponentsResult>;
  updateOperationLayout: (
    input: UpdateOperationLayoutInput,
  ) => Promise<UpdateOperationLayoutResult>;
}

function isValidResponseWidth(w: number): w is 1 | 2 | 4 {
  return w === 1 || w === 2 || w === 4;
}

function toLayoutEntryResponse(entry: LayoutEntry) {
  const { w } = entry;
  if (!isValidResponseWidth(w)) {
    throw new InvalidLayoutError(`entry ${entry.id} has an unexpected width ${w}`);
  }
  return { ...entry, w };
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

export const flowComponentsRoutes: FastifyPluginAsyncZod<FlowComponentsRouteDeps> = async (
  fastify,
  deps,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/flows/:id/components",
    {
      schema: {
        params: flowParamsSchema,
        querystring: getComponentsQuerySchema,
        response: { 200: getComponentsResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { cols } = request.query;

      try {
        const result = await deps.getOperationComponents({ operationId: id, cols });
        reply.code(200).send({
          components: result.components.map(toComponentResponse),
          layout: result.layout.map(toLayoutEntryResponse),
        });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "flow_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.patch(
    "/flows/:id/layout",
    {
      schema: {
        params: flowParamsSchema,
        body: updateLayoutBodySchema,
        response: {
          200: updateLayoutResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { cols, layout } = request.body;

      try {
        const result = await deps.updateOperationLayout({ operationId: id, cols, layout });
        reply
          .code(200)
          .send({ cols: result.cols, layout: result.layout.map(toLayoutEntryResponse) });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "flow_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidLayoutError) {
          reply.code(400).send({ error: "invalid_layout", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
