import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import { InvalidComponentPathError } from "../../domain/model/errors.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";
import { componentNodeSchema, replySchema } from "./component-node-schema.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  skill?: string;
}

export interface UpdateComponentCommandInput {
  children?: ComponentNode[];
  path?: string;
  value?: string;
  componentId: string;
  reply: string;
}

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description:
        'Dotted path to the single field to rewrite, rooted at "children" — for ' +
        'example "children.1.props.body". Use this for every edit that touches one ' +
        "piece of text. The field must already exist.",
    },
    value: {
      type: "string",
      description: "The new text for the field named by path.",
    },
    children: {
      type: "array",
      items: componentNodeSchema,
      description:
        "The component's whole new tree. Only for an edit that adds, removes or " +
        "reorders nodes. Anything left out is deleted.",
    },
    componentId: { type: "string" },
    reply: replySchema,
  },
  required: ["componentId", "reply"],
};

export function createUpdateComponentCommand(deps: UpdateComponentCommandDeps): Command {
  const { updateComponentContent, skill } = deps;

  return {
    name: "update_component",
    description:
      "Edit an existing dashboard component identified by componentId. The component " +
      "keeps its size and its place on the grid, and no other component is touched. " +
      "Rewrite one field with path and value; send children only when the set of nodes " +
      "itself has to change, because children replaces the whole tree.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as UpdateComponentCommandInput;
      const scoped = input.path !== undefined;

      // Both shapes at once is not a richer edit, it is two edits that disagree
      // about what the component ends up as. Refusing is the only reading that
      // cannot silently discard one of them.
      if (scoped && input.children !== undefined) {
        throw new InvalidComponentPathError("send either path and value, or children, never both");
      }

      if (!scoped && input.children === undefined) {
        throw new InvalidComponentPathError("an update needs either path and value, or children");
      }

      // No size is passed on purpose: editing a widget's content is not a
      // request to resize it, and a reflow of the board is not what the user
      // asked for when they corrected one number.
      if (scoped) {
        if (typeof input.value !== "string") {
          throw new InvalidComponentPathError("path needs a string value to write");
        }

        const component = await updateComponentContent({
          operationId: context.operationId,
          componentId: input.componentId,
          path: input.path as string,
          value: input.value,
        });
        return { component, reply: input.reply };
      }

      const children = input.children as ComponentNode[];
      validateComponentTree(children);

      const component = await updateComponentContent({
        operationId: context.operationId,
        componentId: input.componentId,
        children,
      });
      return { component, reply: input.reply };
    },
  };
}
