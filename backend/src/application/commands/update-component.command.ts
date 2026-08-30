import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";
import { componentNodeSchema, layoutSchema, replySchema } from "./component-node-schema.js";
import { nearestSize } from "./create-component.command.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  skill?: string;
}

export interface UpdateComponentCommandInput {
  children: ComponentNode[];
  componentId: string;
  layout?: { cols: number; rows: number };
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    children: { type: "array", items: componentNodeSchema },
    componentId: { type: "string" },
    layout: layoutSchema,
    reply: replySchema,
  },
  required: ["children", "componentId", "reply"],
};

export function createUpdateComponentCommand(deps: UpdateComponentCommandDeps): Command {
  const { updateComponentContent, skill } = deps;

  return {
    name: "update_component",
    description:
      "Replace the content of an existing dashboard component identified by componentId. " +
      "Pass the optional layout field (cols, rows) when the component also needs to be " +
      "resized or repositioned in the grid; omit it to update content only.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as UpdateComponentCommandInput;
      validateComponentTree(input.children);

      const sizeField =
        input.layout === undefined
          ? {}
          : { size: nearestSize(input.layout.cols, input.layout.rows) };

      const component = await updateComponentContent({
        operationId: context.operationId,
        componentId: input.componentId,
        children: input.children,
        ...sizeField,
      });
      return { component, reply: input.reply };
    },
  };
}
