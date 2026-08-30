import type { Component } from "../components/component.js";
import type { WidgetSizeName } from "../components/widget-size.js";

export type ComponentEventName = "component-created" | "component-updated" | "component-pending";

/**
 * Fired before the AI's response is known, so the frontend can show a
 * loading placeholder sized like the real widget will be instead of a blank
 * grid. `tempId` lets the frontend drop this placeholder once the matching
 * "component-created" event lands.
 */
export interface ComponentPendingPayload {
  operationId: string;
  tempId: string;
  estimatedSize: WidgetSizeName;
}

export type ComponentEventPayload = Component | ComponentPendingPayload;

export type ComponentEventListener = (
  event: ComponentEventName,
  payload: ComponentEventPayload,
) => void;

export interface ComponentEventPublisher {
  publish(operationId: string, event: ComponentEventName, payload: ComponentEventPayload): void;
  subscribe(operationId: string, listener: ComponentEventListener): () => void;
}
