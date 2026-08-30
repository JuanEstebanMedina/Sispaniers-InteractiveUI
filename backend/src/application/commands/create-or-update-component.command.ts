import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../domain/components/widget-size.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { CreateComponentInput } from "../use-cases/dashboard/create-component.use-case.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";

export interface CreateOrUpdateComponentCommandDeps {
  componentRepository: ComponentRepository;
  createComponent: (input: CreateComponentInput) => Promise<Component>;
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
}

export interface CreateOrUpdateComponentInput {
  children: ComponentNode[];
  layout: { cols: number; rows: number };
  supersedes?: string | null;
}

const componentNodeSchema: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string" },
    order: { type: "number" },
    props: { type: "object" },
  },
  required: ["kind", "order", "props"],
};

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    children: { type: "array", items: componentNodeSchema },
    layout: {
      type: "object",
      properties: { cols: { type: "number" }, rows: { type: "number" } },
      required: ["cols", "rows"],
    },
    supersedes: { type: "string", nullable: true },
  },
  required: ["children", "layout"],
};

function nearestSize(cols: number, rows: number): WidgetSizeName {
  let bestName: WidgetSizeName = "small";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [name, dimensions] of Object.entries(WIDGET_SIZES) as Array<
    [WidgetSizeName, { w: number; h: number }]
  >) {
    const distance = (dimensions.w - cols) ** 2 + (dimensions.h - rows) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = name;
    }
  }

  return bestName;
}

export function createCreateOrUpdateComponentCommand(
  deps: CreateOrUpdateComponentCommandDeps,
): Command {
  const { componentRepository, createComponent, updateComponentContent } = deps;

  return {
    name: "create_or_update_component",
    description:
      "Create a new dashboard component, or replace the content of an existing one when supersedes names it.",
    inputSchema,

    async execute(rawInput: unknown, context: CommandContext): Promise<Component> {
      const input = rawInput as CreateOrUpdateComponentInput;
      validateComponentTree(input.children);

      const supersedes =
        typeof input.supersedes === "string" && input.supersedes.length > 0
          ? input.supersedes
          : null;

      if (supersedes !== null) {
        const target = await componentRepository.findById(supersedes);
        if (target !== null && target.operationId === context.operationId) {
          return updateComponentContent({
            operationId: context.operationId,
            componentId: supersedes,
            children: input.children,
          });
        }
        console.warn(
          `create_or_update_component: ignoring hallucinated supersedes id ${supersedes}`,
        );
      }

      return createComponent({
        operationId: context.operationId,
        kind: "container",
        children: input.children,
        size: nearestSize(input.layout.cols, input.layout.rows),
      });
    },
  };
}
