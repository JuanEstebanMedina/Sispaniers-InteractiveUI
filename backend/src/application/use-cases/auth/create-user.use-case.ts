import type { Role } from "../../../domain/enums/role.js";
import type { User } from "../../../domain/logistics/user.js";
import { EmailConflictError, ForbiddenCompanyScopeError } from "../../../domain/model/errors.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { PasswordHasher } from "../../../domain/ports/password-hasher.port.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

export interface CreateUserInput {
  actorRole: Role;
  actorCompanyId?: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  companyId?: string;
}

export interface CreateUserDeps {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  idGenerator: IdGenerator;
}

export function createCreateUserUseCase(deps: CreateUserDeps) {
  const { userRepository, passwordHasher, idGenerator } = deps;

  return async function createUser(input: CreateUserInput): Promise<User> {
    const isSuperadmin = input.actorRole === "superadmin";

    if (!isSuperadmin && input.role === "superadmin") {
      throw new ForbiddenCompanyScopeError();
    }

    const companyId = isSuperadmin ? input.companyId : input.actorCompanyId;

    const existing = await userRepository.findByEmail(input.email);
    if (existing !== null) {
      throw new EmailConflictError(input.email);
    }

    const passwordHash = await passwordHasher.hash(input.password);

    const user: User = {
      id: idGenerator.newId(),
      ...(companyId !== undefined ? { companyId } : {}),
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      active: true,
    };

    await userRepository.save(user);

    return user;
  };
}
