import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../domain/components/widget-size.js";
import type { CreateComponentInput } from "../use-cases/dashboard/create-component.use-case.js";

export interface CreateComponentCommandDeps {
  createComponent: (input: CreateComponentInput) => Promise<Component>;
}

export interface CreateComponentCommandInput {
  children: ComponentNode[];
  layout: { cols: number; rows: number };
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

export function createCreateComponentCommand(deps: CreateComponentCommandDeps): Command {
  const { createComponent } = deps;

  return {
    name: "create_component",
    description: "Create a new dashboard component.",
    inputSchema,

    async execute(rawInput: unknown, context: CommandContext): Promise<Component> {
      const input = rawInput as CreateComponentCommandInput;
      validateComponentTree(input.children);

      return createComponent({
        operationId: context.operationId,
        kind: "container",
        children: input.children,
        size: nearestSize(input.layout.cols, input.layout.rows),
      });
    },
  };
}
