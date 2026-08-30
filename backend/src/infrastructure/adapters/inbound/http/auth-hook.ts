import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "../../../../domain/enums/role.js";
import type { AuthTokenPort } from "../../../../domain/ports/auth-token.port.js";

export interface Actor {
  id: string;
  companyId?: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor;
  }
}

const BEARER_PREFIX = "Bearer ";

function extractToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  return header.slice(BEARER_PREFIX.length);
}

export function createAuthenticateHook(verifyAccessToken: AuthTokenPort["verifyAccessToken"]) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractToken(request.headers.authorization);

    if (token === undefined) {
      reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      request.actor = {
        id: payload.sub,
        role: payload.role,
        ...(payload.companyId !== undefined ? { companyId: payload.companyId } : {}),
      };
    } catch {
      reply.code(401).send({ error: "unauthorized", message: "Invalid or expired token" });
      return;
    }
  };
}
