import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import { validateComponentTree } from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import type { WidgetSizeName } from "../../domain/components/widget-size.js";
import { InvalidComponentPathError } from "../../domain/model/errors.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";
import type { UpdateComponentPlacementInput } from "../use-cases/dashboard/update-component-placement.use-case.js";
import { componentNodeSchema, layoutSchema, replySchema } from "./component-node-schema.js";
import { nearestSize } from "./create-component.command.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  updateComponentPlacement: (input: UpdateComponentPlacementInput) => Promise<Component>;
  skill?: string;
}

export interface UpdateComponentCommandInput {
  children?: ComponentNode[];
  path?: string;
  value?: string;
  componentId: string;
  layout?: { cols: number; rows: number };
  position?: number;
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
      "Rewrite one field with path and value; send children only when the set of nodes " +
      "itself has to change, because children replaces the whole tree. " +
      "Moving adjusts sibling positions automatically.",
    inputSchema,
    ...(skill === undefined ? {} : { skill }),

    async execute(
      rawInput: unknown,
      context: CommandContext,
    ): Promise<{ component: Component; reply: string }> {
      const input = rawInput as UpdateComponentCommandInput;
      const scoped = input.path !== undefined;

      // Both content shapes at once is not a richer edit, it is two edits that
      // disagree about what the component ends up as. Refusing is the only
      // reading that cannot silently discard one of them.
      if (scoped && input.children !== undefined) {
        throw new InvalidComponentPathError("send either path and value, or children, never both");
      }
      if (
        !scoped &&
        input.children === undefined &&
        input.layout === undefined &&
        input.position === undefined
      ) {
        throw new Error("update_component needs path, children, layout, or position");
      }
      if (input.children !== undefined) validateComponentTree(input.children);

      const size: WidgetSizeName | undefined =
        input.layout === undefined ? undefined : nearestSize(input.layout.cols, input.layout.rows);
      let component!: Component;
      // A narrow edit writes one field and nothing else, so a size that came
      // with it travels the placement path below, same as a resize on its own.
      if (scoped) {
        if (typeof input.value !== "string") {
          throw new InvalidComponentPathError("path needs a string value to write");
        }
        component = await updateComponentContent({
          operationId: context.operationId,
          componentId: input.componentId,
          path: input.path as string,
          value: input.value,
        });
      } else if (input.children !== undefined) {
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
