import type { Component } from "./component.js";

/**
 * Every new operation starts with an empty dashboard — nothing tells a first-
 * time user the chat exists, let alone what to ask it. This is the one
 * component every operation gets for free, pointing at both.
 */
export function buildWelcomeComponent(operationId: string, createdAt: Date): Component {
  return {
    id: `${operationId}-welcome`,
    operationId,
    order: 0,
    size: "small",
    kind: "container",
    children: [
      { kind: "title", order: 0, props: { text: "👋 Welcome to your operation!" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: "💬 Talk to Ari, your operations assistant, from the chat panel in the top-right corner.",
        },
      },
      {
        kind: "label",
        order: 2,
        props: {
          text:
            '✨ Try asking things like: "what\'s the latest ETA?", "show me containers by ' +
            'state", or "summarize this operation\'s documents".',
        },
      },
      {
        kind: "label",
        order: 3,
        props: {
          text:
            "🚀 Don't stop at the basics — ask for something different every time. Ari can " +
            "build charts, timelines, tables and a lot more.",
        },
      },
    ],
    createdAt,
  };
}
