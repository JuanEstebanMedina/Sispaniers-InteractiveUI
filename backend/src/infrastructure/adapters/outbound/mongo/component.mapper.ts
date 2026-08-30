import type { Component } from "../../../../domain/components/component.js";

export type ComponentDocument = Omit<Component, "id"> & { _id: string };

export function toComponentDocument({ id, ...rest }: Component): ComponentDocument {
  return { _id: id, ...rest };
}

export function toComponent({ _id, ...rest }: ComponentDocument): Component {
  return { id: _id, ...rest };
}
