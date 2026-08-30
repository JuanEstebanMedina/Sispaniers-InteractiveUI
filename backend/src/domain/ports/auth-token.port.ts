import type { Role } from "../enums/role.js";

export interface AuthTokenPayload {
  sub: string;
  companyId?: string;
  role: Role;
}

export interface AuthTokenPort {
  signAccessToken(payload: AuthTokenPayload): string;
  signRefreshToken(payload: AuthTokenPayload): string;
  /** Throws if the token is missing, expired, malformed, or not an access token. */
  verifyAccessToken(token: string): AuthTokenPayload;
  /** Throws if the token is missing, expired, malformed, or not a refresh token. */
  verifyRefreshToken(token: string): AuthTokenPayload;
}
