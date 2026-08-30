import type { Role } from "../../../domain/enums/role.js";
import type { User } from "../../../domain/logistics/user.js";
import { ForbiddenCompanyScopeError, UserNotFoundError } from "../../../domain/model/errors.js";
import type { PasswordHasher } from "../../../domain/ports/password-hasher.port.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

export interface UpdateUserInput {
  actorRole: Role;
  actorCompanyId?: string;
  id: string;
  name?: string;
  role?: Role;
  active?: boolean;
  password?: string;
}

export interface UpdateUserDeps {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
}

export function createUpdateUserUseCase(deps: UpdateUserDeps) {
  const { userRepository, passwordHasher } = deps;

  return async function updateUser(input: UpdateUserInput): Promise<User> {
    const target = await userRepository.findById(input.id);
    if (target === null) {
      throw new UserNotFoundError(input.id);
    }

    const isSuperadmin = input.actorRole === "superadmin";

    if (!isSuperadmin) {
      if (target.companyId !== input.actorCompanyId) {
        throw new ForbiddenCompanyScopeError();
      }
      if (input.role === "superadmin") {
        throw new ForbiddenCompanyScopeError();
      }
    }

    const passwordHash =
      input.password !== undefined ? await passwordHasher.hash(input.password) : undefined;

    const updated: User = {
      ...target,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
    };

    await userRepository.save(updated);

    return updated;
  };
}
