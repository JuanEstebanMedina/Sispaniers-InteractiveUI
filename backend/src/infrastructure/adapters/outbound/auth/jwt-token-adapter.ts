import jwt from "jsonwebtoken";
import type { Role } from "../../../../domain/enums/role.js";
import type { AuthTokenPayload, AuthTokenPort } from "../../../../domain/ports/auth-token.port.js";

const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

type TokenType = "access" | "refresh";

interface SignedClaims {
  sub: string;
  companyId?: string;
  role: Role;
  type: TokenType;
}

export class JwtTokenAdapter implements AuthTokenPort {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret) {
      throw new Error("JwtTokenAdapter requires a non-empty secret");
    }
    this.secret = secret;
  }

  signAccessToken(payload: AuthTokenPayload): string {
    return this.sign(payload, "access", ACCESS_TOKEN_TTL_SECONDS);
  }

  signRefreshToken(payload: AuthTokenPayload): string {
    return this.sign(payload, "refresh", REFRESH_TOKEN_TTL_SECONDS);
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    return this.verify(token, "access");
  }

  verifyRefreshToken(token: string): AuthTokenPayload {
    return this.verify(token, "refresh");
  }

  private sign(payload: AuthTokenPayload, type: TokenType, expiresInSeconds: number): string {
    const claims: SignedClaims = {
      sub: payload.sub,
      role: payload.role,
      type,
      ...(payload.companyId !== undefined ? { companyId: payload.companyId } : {}),
    };

    return jwt.sign(claims, this.secret, { expiresIn: expiresInSeconds });
  }

  private verify(token: string, expectedType: TokenType): AuthTokenPayload {
    const decoded = jwt.verify(token, this.secret) as SignedClaims;

    if (decoded.type !== expectedType) {
      throw new Error(`Expected a ${expectedType} token`);
    }

    return {
      sub: decoded.sub,
      role: decoded.role,
      ...(decoded.companyId !== undefined ? { companyId: decoded.companyId } : {}),
    };
  }
}
