import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../domain/components/widget-size.js";
import { COMPONENT_PRIORITIES, type ComponentPriority } from "../../domain/enums/widget-kind.js";
import type { CreateComponentInput } from "../use-cases/dashboard/create-component.use-case.js";
import { componentNodeSchema, layoutSchema, replySchema } from "./component-node-schema.js";

export interface CreateComponentCommandDeps {
  createComponent: (input: CreateComponentInput) => Promise<Component>;
  skill?: string;
}

export interface CreateComponentCommandInput {
  children: ComponentNode[];
  layout: { cols: number; rows: number };
  priority?: ComponentPriority;
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    children: { type: "array", items: componentNodeSchema },
    layout: layoutSchema,
    priority: { type: "string", enum: [...COMPONENT_PRIORITIES] },
    reply: replySchema,
  },
  required: ["children", "layout", "reply"],
};

export function nearestSize(cols: number, rows: number): WidgetSizeName {
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
  const { createComponent, skill } = deps;

  return {
    name: "create_component",
    description: "Create a new dashboard component.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as CreateComponentCommandInput;
      validateComponentTree(input.children);

      const component = await createComponent({
        operationId: context.operationId,
        kind: "container",
        children: input.children,
        size: nearestSize(input.layout.cols, input.layout.rows),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
      });
      return { component, reply: input.reply };
    },
  };
}
