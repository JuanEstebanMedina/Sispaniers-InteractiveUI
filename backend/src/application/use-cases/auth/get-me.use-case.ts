import type { User } from "../../../domain/logistics/user.js";
import { UserNotFoundError } from "../../../domain/model/errors.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

export interface GetMeInput {
  userId: string;
}

export interface GetMeDeps {
  userRepository: UserRepository;
}

export function createGetMeUseCase(deps: GetMeDeps) {
  const { userRepository } = deps;

  return async function getMe(input: GetMeInput): Promise<User> {
    const user = await userRepository.findById(input.userId);

    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    return user;
  };
}
