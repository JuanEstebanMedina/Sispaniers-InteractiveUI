import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import type { WidgetSizeName } from "../../domain/components/widget-size.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";
import type { UpdateComponentPlacementInput } from "../use-cases/dashboard/update-component-placement.use-case.js";
import { nearestSize } from "./create-component.command.js";
import { componentNodeSchema, layoutSchema, replySchema } from "./component-node-schema.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  updateComponentPlacement: (input: UpdateComponentPlacementInput) => Promise<Component>;
  skill?: string;
}

export interface UpdateComponentCommandInput {
  children?: ComponentNode[];
  componentId: string;
  layout?: { cols: number; rows: number };
  position?: number;
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    children: { type: "array", items: componentNodeSchema },
    componentId: { type: "string" },
    layout: layoutSchema,
    position: { type: "number" },
    reply: replySchema,
  },
  required: ["componentId", "reply"],
};

export function createUpdateComponentCommand(deps: UpdateComponentCommandDeps): Command {
  const { updateComponentContent, updateComponentPlacement, skill } = deps;

  return {
    name: "update_component",
    description:
      "Update exactly one dashboard component: its content, size, or grid order. " +
      "Moving adjusts sibling positions automatically.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as UpdateComponentCommandInput;
      if (input.children === undefined && input.layout === undefined && input.position === undefined) {
        throw new Error("update_component needs children, layout, or position");
      }
      if (input.children !== undefined) validateComponentTree(input.children);

      const size: WidgetSizeName | undefined =
        input.layout === undefined ? undefined : nearestSize(input.layout.cols, input.layout.rows);
      let component!: Component;
      if (input.children !== undefined) {
        component = await updateComponentContent({
          operationId: context.operationId,
          componentId: input.componentId,
          children: input.children,
          ...(size === undefined ? {} : { size }),
        });
      }
      if (input.position !== undefined || (input.children === undefined && size !== undefined)) {
        component = await updateComponentPlacement({
          operationId: context.operationId,
          componentId: input.componentId,
          ...(input.children === undefined && size !== undefined ? { size } : {}),
          ...(input.position === undefined ? {} : { position: input.position }),
        });
      }
      return { component, reply: input.reply };
    },
  };
}
