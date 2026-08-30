import type { Command, CommandContext } from "../../domain/commands/command.js";
import type { JsonSchema } from "../../domain/commands/json-schema.js";
import {
  validateComponentSize,
  validateComponentTree,
} from "../../domain/components/component-node.js";
import type { Component, ComponentNode } from "../../domain/components/component.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../domain/components/widget-size.js";
import type { ComponentEventPublisher } from "../../domain/ports/component-event-publisher.port.js";
import type { ComponentRepository } from "../../domain/ports/component.repository.js";
import type { UpdateComponentContentInput } from "../use-cases/dashboard/update-component-content.use-case.js";

export interface UpdateComponentCommandDeps {
  updateComponentContent: (input: UpdateComponentContentInput) => Promise<Component>;
  componentRepository: ComponentRepository;
  eventPublisher: ComponentEventPublisher;
}

export interface UpdateComponentCommandInput {
  children: ComponentNode[];
  componentId: string;
  layout?: { cols: number; rows: number };
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
    componentId: { type: "string" },
    layout: {
      type: "object",
      properties: { cols: { type: "number" }, rows: { type: "number" } },
      required: ["cols", "rows"],
    },
  },
  required: ["children", "componentId"],
};

// ponytail: duplicated from create-component.command.ts (not exported there) —
// extract to a shared module if a third caller shows up.
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

export function createUpdateComponentCommand(deps: UpdateComponentCommandDeps): Command {
  const { updateComponentContent, componentRepository, eventPublisher } = deps;

  return {
    name: "update_component",
    description:
      "Replace the content of an existing dashboard component identified by componentId. " +
      "Pass the optional layout field (cols, rows) when the component also needs to be " +
      "resized or repositioned in the grid; omit it to update content only.",
    inputSchema,

    async execute(rawInput: unknown, context: CommandContext): Promise<Component> {
      const input = rawInput as UpdateComponentCommandInput;
      validateComponentTree(input.children);

      const updated = await updateComponentContent({
        operationId: context.operationId,
        componentId: input.componentId,
        children: input.children,
      });

      if (input.layout === undefined) {
        return updated;
      }

      const size = nearestSize(input.layout.cols, input.layout.rows);
      validateComponentSize(size, input.children);

      const resized: Component = { ...updated, size };
      await componentRepository.save(resized);
      eventPublisher.publish(resized.operationId, "component-updated", resized);

      return resized;
    },
  };
}
