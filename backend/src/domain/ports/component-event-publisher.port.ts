import type { Component } from "../components/component.js";

export type ComponentEventName = "component-created" | "component-updated";

export type ComponentEventListener = (event: ComponentEventName, component: Component) => void;

export interface ComponentEventPublisher {
  publish(operationId: string, event: ComponentEventName, component: Component): void;
  subscribe(operationId: string, listener: ComponentEventListener): () => void;
}
