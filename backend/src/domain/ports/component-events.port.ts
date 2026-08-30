export interface ComponentEvent {
  type: "component-created";
  operationId: string;
  component: unknown;
}

export interface ComponentEventsBroadcaster {
  publish(operationId: string, event: ComponentEvent): void;
  subscribe(operationId: string, listener: (event: ComponentEvent) => void): () => void;
}
