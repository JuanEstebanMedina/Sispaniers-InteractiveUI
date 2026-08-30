import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";
import { componentNodeSchema, replySchema } from "./component-node-schema.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  skill?: string;
}

export interface UpdateComponentCommandInput {
  children: ComponentNode[];
  componentId: string;
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    children: { type: "array", items: componentNodeSchema },
    componentId: { type: "string" },
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
      "The component keeps its size and its place on the grid, and no other component is " +
      "touched. children replaces the whole tree, so it must carry every node the " +
      "component should still have afterwards.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as UpdateComponentCommandInput;
      validateComponentTree(input.children);

      // No size is passed on purpose: editing a widget's content is not a
      // request to resize it, and a reflow of the board is not what the user
      // asked for when they corrected one number.
      const component = await updateComponentContent({
        operationId: context.operationId,
        componentId: input.componentId,
        children: input.children,
      });
      return { component, reply: input.reply };
    },
  };
}
