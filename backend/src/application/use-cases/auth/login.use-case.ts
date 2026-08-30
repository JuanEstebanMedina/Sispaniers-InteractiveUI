import type { User } from "../../../domain/logistics/user.js";
import { InvalidCredentialsError } from "../../../domain/model/errors.js";
import type { AuthTokenPort } from "../../../domain/ports/auth-token.port.js";
import type { PasswordHasher } from "../../../domain/ports/password-hasher.port.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

const ACCESS_TOKEN_TTL_SECONDS = 1800;

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginDeps {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  authTokenPort: AuthTokenPort;
}

export function createLoginUseCase(deps: LoginDeps) {
  const { userRepository, passwordHasher, authTokenPort } = deps;

  return async function login(input: LoginInput): Promise<LoginResult> {
    const user = await userRepository.findByEmail(input.email);

    if (user === null || !user.active) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await passwordHasher.verify(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const payload = {
      sub: user.id,
      role: user.role,
      ...(user.companyId !== undefined ? { companyId: user.companyId } : {}),
    };

    return {
      user,
      accessToken: authTokenPort.signAccessToken(payload),
      refreshToken: authTokenPort.signRefreshToken(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  };
}
