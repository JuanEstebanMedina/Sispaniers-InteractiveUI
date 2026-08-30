import { InvalidCredentialsError } from "../../../domain/model/errors.js";
import type { AuthTokenPort } from "../../../domain/ports/auth-token.port.js";
import type { UserRepository } from "../../../domain/ports/user.repository.js";

const ACCESS_TOKEN_TTL_SECONDS = 1800;

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenDeps {
  userRepository: UserRepository;
  authTokenPort: AuthTokenPort;
}

export function createRefreshTokenUseCase(deps: RefreshTokenDeps) {
  const { userRepository, authTokenPort } = deps;

  return async function refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResult> {
    const decoded = authTokenPort.verifyRefreshToken(input.refreshToken);
    const user = await userRepository.findById(decoded.sub);

    if (user === null || !user.active) {
      throw new InvalidCredentialsError();
    }

    const payload = {
      sub: user.id,
      role: user.role,
      ...(user.companyId !== undefined ? { companyId: user.companyId } : {}),
    };

    return {
      accessToken: authTokenPort.signAccessToken(payload),
      refreshToken: authTokenPort.signRefreshToken(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  };
}
