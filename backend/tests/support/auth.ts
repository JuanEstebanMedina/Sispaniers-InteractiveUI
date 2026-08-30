import type { Role } from "../../src/domain/enums/role.js";
import { JwtTokenAdapter } from "../../src/infrastructure/adapters/outbound/auth/jwt-token-adapter.js";

const TEST_ACTOR_SUB = "test-actor";

export function authHeader(role: Role, companyId?: string): { Authorization: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be set before signing test tokens");
  }

  const tokenAdapter = new JwtTokenAdapter(secret);
  const token = tokenAdapter.signAccessToken({
    sub: TEST_ACTOR_SUB,
    role,
    ...(companyId !== undefined ? { companyId } : {}),
  });

  return { Authorization: `Bearer ${token}` };
}
