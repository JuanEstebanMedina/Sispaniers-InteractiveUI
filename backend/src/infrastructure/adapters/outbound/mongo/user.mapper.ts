import type { User } from "../../../../domain/logistics/user.js";

export type UserDocument = Omit<User, "id"> & { _id: string };

export function toUserDocument({ id, ...rest }: User): UserDocument {
  return { _id: id, ...rest };
}

export function toUser({ _id, ...rest }: UserDocument): User {
  return { id: _id, ...rest };
}
