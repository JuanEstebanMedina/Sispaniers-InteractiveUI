import type { Operation } from "../../../../domain/model/operation.js";

export type OperationDocument = Omit<Operation, "id"> & { _id: string };

export function toOperationDocument({ id, ...rest }: Operation): OperationDocument {
  return { _id: id, ...rest };
}

export function toOperation({ _id, ...rest }: OperationDocument): Operation {
  return { id: _id, ...rest };
}
