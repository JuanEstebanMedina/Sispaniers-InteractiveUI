import type { Component } from "../components/component.js";
import type { WidgetSizeName } from "../components/widget-size.js";

export type ComponentEventName =
  | "component-created"
  | "component-updated"
  | "component-pending"
  | "component-pending-cleared";

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

/**
 * Fired when a chat turn resolves without a component (the AI answered in
 * plain text — e.g. it couldn't build anything from the request). Without
 * this, the placeholder from "component-pending" has nothing to clear it and
 * sits on screen, looking like a stuck blank widget, until its timeout fires.
 */
export type ComponentEventPayload = Component | ComponentPendingPayload | null;

export type ComponentEventListener = (
  event: ComponentEventName,
  payload: ComponentEventPayload,
) => void;

export interface ComponentEventPublisher {
  publish(operationId: string, event: ComponentEventName, payload: ComponentEventPayload): void;
  subscribe(operationId: string, listener: ComponentEventListener): () => void;
}
