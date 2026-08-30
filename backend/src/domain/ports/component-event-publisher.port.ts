import type { Component } from "../components/component.js";
import type { WidgetSizeName } from "../components/widget-size.js";

export type ComponentEventName =
  | "component-created"
  | "component-updated"
  | "component-pending"
  | "component-pending-cleared";

/**
 * Fired only after AI selects a component-building tool, so the frontend can
 * show a loading placeholder sized like the real widget instead of a blank
 * grid. `tempId` lets the frontend drop this placeholder once the matching
 * "component-created" event lands.
 */
export interface ComponentPendingPayload {
  operationId: string;
  tempId: string;
  estimatedSize: WidgetSizeName;
}

/**
 * Fired when a chat turn resolves without a component after a pending event.
 * Without this, the placeholder has nothing to clear it and sits on screen
 * until its timeout fires.
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
