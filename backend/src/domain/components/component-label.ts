import type { Component, ComponentNode } from "./component.js";

function firstTitleText(nodes: ComponentNode[]): string | null {
  for (const node of [...nodes].sort((a, b) => a.order - b.order)) {
    if (node.kind === "title") {
      const { text } = node.props;
      if (typeof text === "string" && text.length > 0) {
        return text;
      }
    }

    if ("children" in node && node.children !== undefined) {
      const nested = firstTitleText(node.children);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

/**
 * What to call a component in front of a model or a person.
 *
 * The agent identifies an existing component from this and nothing else, so a
 * component with no name is one the user cannot ask about by describing it.
 * Mirrors `liftTitle` in the frontend's `toWidgets`.
 */
export function componentLabel(component: Component): string | null {
  return component.title ?? firstTitleText(component.children);
}
