import type { Role } from "../../../domain/enums/role.js";
import type { User } from "../../../domain/logistics/user.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

export interface ListUsersInput {
  actorRole: Role;
  actorCompanyId?: string;
  companyId?: string;
}

export interface ListUsersDeps {
  userRepository: UserRepository;
}

export function createListUsersUseCase(deps: ListUsersDeps) {
  const { userRepository } = deps;

  return async function listUsers(input: ListUsersInput): Promise<User[]> {
    const scopedCompanyId =
      input.actorRole === "superadmin" ? input.companyId : input.actorCompanyId;

    return userRepository.findAllByCompany(scopedCompanyId);
  };
}
