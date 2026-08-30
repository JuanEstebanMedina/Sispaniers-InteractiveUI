import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { CreateComponentInput } from "../../../../../../application/use-cases/dashboard/create-component.use-case.js";
import type { DeleteComponentInput } from "../../../../../../application/use-cases/dashboard/delete-component.use-case.js";
import type {
  GetOperationComponentsInput,
  GetOperationComponentsResult,
} from "../../../../../../application/use-cases/dashboard/get-operation-components.use-case.js";
import type { UpdateComponentContentInput } from "../../../../../../application/use-cases/dashboard/update-component-content.use-case.js";
import type { UpdateComponentPlacementInput } from "../../../../../../application/use-cases/dashboard/update-component-placement.use-case.js";
import type { Component } from "../../../../../../domain/components/component.js";
import type { LayoutEntry } from "../../../../../../domain/components/layout.js";
import {
  ComponentNotFoundError,
  InvalidComponentPathError,
  InvalidComponentTreeError,
  InvalidLayoutError,
  OperationNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { toComponentWireShape } from "../../mappers/component.mapper.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  componentResponseSchema,
  createComponentBodySchema,
  getComponentsQuerySchema,
  getComponentsResponseSchema,
  updateComponentContentBodySchema,
  updateComponentContentResponseSchema,
  updateComponentPlacementBodySchema,
} from "../../schemas/operation-component.schema.js";

const operationParamsSchema = z.object({ id: z.string().min(1) });
const operationComponentParamsSchema = z.object({
  id: z.string().min(1),
  componentId: z.string().min(1),
});

export interface OperationComponentsRouteDeps {
  getOperationComponents: (
    input: GetOperationComponentsInput,
  ) => Promise<GetOperationComponentsResult>;
  updateComponentPlacement: (input: UpdateComponentPlacementInput) => Promise<Component>;
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  createComponent: (input: CreateComponentInput) => Promise<Component>;
  deleteComponent: (input: DeleteComponentInput) => Promise<void>;
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

export const operationComponentsRoutes: FastifyPluginAsyncZod<
  OperationComponentsRouteDeps
> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/operations/:id/components",
    {
      schema: {
        params: operationParamsSchema,
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
          components: result.components.map(toComponentWireShape),
          layout: result.layout.map(toLayoutEntryResponse),
        });
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.patch(
    "/operations/:id/components/:componentId/placement",
    {
      schema: {
        params: operationComponentParamsSchema,
        body: updateComponentPlacementBodySchema,
        response: {
          200: componentResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id, componentId } = request.params;
      const { position, title } = request.body;

      try {
        const component = await deps.updateComponentPlacement({
          operationId: id,
          componentId,
          ...(position !== undefined ? { position } : {}),
          ...(title !== undefined ? { title } : {}),
        });
        reply.code(200).send(toComponentWireShape(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof ComponentNotFoundError) {
          reply.code(404).send({ error: "component_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.patch(
    "/operations/:id/components/:componentId",
    {
      schema: {
        params: operationComponentParamsSchema,
        body: updateComponentContentBodySchema,
        response: {
          200: updateComponentContentResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id, componentId } = request.params;
      const body = request.body;

      try {
        const component = await deps.updateComponentContent(
          "path" in body
            ? { operationId: id, componentId, path: body.path, value: body.value }
            : { operationId: id, componentId, children: body.content },
        );
        reply.code(200).send(toComponentWireShape(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof ComponentNotFoundError) {
          reply.code(404).send({ error: "component_not_found", message: error.message });
          return;
        }
        if (
          error instanceof InvalidComponentPathError ||
          error instanceof InvalidComponentTreeError
        ) {
          reply.code(400).send({ error: "invalid_component_content", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  // ponytail/TEMPORARY: dev-only scaffold to exercise create -> validate ->
  // persist -> SSE-notify end-to-end without the real AI-agent caller wired
  // up yet (SPEC-CC-007). Remove once create-component has a real caller.
  app.post(
    "/operations/:id/components/test-create",
    {
      schema: {
        params: operationParamsSchema,
        body: createComponentBodySchema,
        response: {
          201: componentResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { kind, size, priority, children } = request.body;

      try {
        const component = await deps.createComponent({
          operationId: id,
          kind,
          size,
          children,
          // Spread rather than passed through: exactOptionalPropertyTypes draws
          // a line between "absent" and "explicitly undefined".
          ...(priority !== undefined ? { priority } : {}),
        });
        reply.code(201).send(toComponentWireShape(component));
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof InvalidComponentTreeError) {
          reply.code(400).send({ error: "invalid_component_tree", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
  app.delete(
    "/operations/:id/components/:componentId",
    {
      schema: {
        params: operationComponentParamsSchema,
        response: { 204: z.null(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { id, componentId } = request.params;

      try {
        await deps.deleteComponent({ operationId: id, componentId });
        reply.code(204).send(null);
      } catch (error) {
        if (error instanceof OperationNotFoundError) {
          reply.code(404).send({ error: "operation_not_found", message: error.message });
          return;
        }
        if (error instanceof ComponentNotFoundError) {
          reply.code(404).send({ error: "component_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
