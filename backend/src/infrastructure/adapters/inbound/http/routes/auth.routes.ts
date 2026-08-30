import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import type { GetMeInput } from "../../../../../application/use-cases/auth/get-me.use-case.js";
import type {
  LoginInput,
  LoginResult,
} from "../../../../../application/use-cases/auth/login.use-case.js";
import type {
  RefreshTokenInput,
  RefreshTokenResult,
} from "../../../../../application/use-cases/auth/refresh-token.use-case.js";
import type { User } from "../../../../../domain/logistics/user.js";
import { InvalidCredentialsError, UserNotFoundError } from "../../../../../domain/model/errors.js";
import {
  authUserResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
  tokenPairResponseSchema,
} from "../schemas/auth.schema.js";
import { errorResponseSchema } from "../schemas/error.schema.js";

export interface AuthRouteDeps {
  login: (input: LoginInput) => Promise<LoginResult>;
  refreshToken: (input: RefreshTokenInput) => Promise<RefreshTokenResult>;
}

export interface AuthMeRouteDeps {
  getMe: (input: GetMeInput) => Promise<User>;
}

export function toAuthUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.companyId !== undefined ? { companyId: user.companyId } : {}),
    active: user.active,
  };
}

export const authRoutes: FastifyPluginAsyncZod<AuthRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/auth/login",
    {
      schema: {
        body: loginBodySchema,
        response: { 200: loginResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await deps.login(request.body);
        reply.code(200).send({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          user: toAuthUserResponse(result.user),
        });
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          reply.code(401).send({ error: "invalid_credentials", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        body: refreshBodySchema,
        response: { 200: tokenPairResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await deps.refreshToken({ refreshToken: request.body.refresh_token });
        reply.code(200).send(result);
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          reply.code(401).send({ error: "invalid_credentials", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.post("/auth/logout", async (_request, reply) => {
    reply.code(204).send();
  });
};

export const authMeRoutes: FastifyPluginAsyncZod<AuthMeRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/auth/me",
    { schema: { response: { 200: authUserResponseSchema, 404: errorResponseSchema } } },
    async (request, reply) => {
      try {
        const user = await deps.getMe({ userId: request.actor.id });
        reply.code(200).send(toAuthUserResponse(user));
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          reply.code(404).send({ error: "user_not_found", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
