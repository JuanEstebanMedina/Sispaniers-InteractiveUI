import type { Component } from "../../../../domain/components/component.js";

export type ComponentDocument = Omit<Component, "id"> & { _id: string };

export function toComponentDocument({ id, ...rest }: Component): ComponentDocument {
  return { _id: id, ...rest };
}

/**
 * `order` is younger than the collection, so documents written before it exists
 * carry none. The type says otherwise, which is exactly why it has to be
 * checked here: an absent order reaches the domain as `undefined`, and from
 * there `order - order` and `Math.max` turn the whole sequence into NaN.
 *
 * They all collapse to 0 and `createdAt` breaks the tie, so an operation the
 * user never rearranged still reads in the order the agent wrote it.
 */
export function toComponent({ _id, ...rest }: ComponentDocument): Component {
  return {
    id: _id,
    ...rest,
    order: Number.isFinite(rest.order) ? rest.order : 0,
  };
}
