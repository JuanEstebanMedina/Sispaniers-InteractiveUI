import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { CreateUserInput } from "../../../../../../application/use-cases/auth/create-user.use-case.js";
import type { ListUsersInput } from "../../../../../../application/use-cases/auth/list-users.use-case.js";
import type { UpdateUserInput } from "../../../../../../application/use-cases/auth/update-user.use-case.js";
import type { User } from "../../../../../../domain/logistics/user.js";
import {
  EmailConflictError,
  ForbiddenCompanyScopeError,
  UserNotFoundError,
} from "../../../../../../domain/model/errors.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  listUsersResponseSchema,
  updateUserBodySchema,
  userResponseSchema,
} from "../../schemas/user.schema.js";

const userParamsSchema = z.object({ id: z.string().min(1) });

export interface UsersRouteDeps {
  createUser: (input: CreateUserInput) => Promise<User>;
  listUsers: (input: ListUsersInput) => Promise<User[]>;
  updateUser: (input: UpdateUserInput) => Promise<User>;
}

function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(user.companyId !== undefined ? { company_id: user.companyId } : {}),
    active: user.active,
  };
}

export const usersRoutes: FastifyPluginAsyncZod<UsersRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/users",
    {
      schema: {
        querystring: listUsersQuerySchema,
        response: { 200: listUsersResponseSchema },
      },
    },
    async (request, reply) => {
      const { actor } = request;
      const companyId = actor.role === "superadmin" ? request.query.company_id : undefined;

      const users = await deps.listUsers({
        actorRole: actor.role,
        ...(actor.companyId !== undefined ? { actorCompanyId: actor.companyId } : {}),
        ...(companyId !== undefined ? { companyId } : {}),
      });

      reply.code(200).send({ users: users.map(toUserResponse) });
    },
  );

  app.post(
    "/users",
    {
      schema: {
        body: createUserBodySchema,
        response: {
          201: userResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const dto = request.body;
      const { actor } = request;

      try {
        const user = await deps.createUser({
          actorRole: actor.role,
          ...(actor.companyId !== undefined ? { actorCompanyId: actor.companyId } : {}),
          email: dto.email,
          password: dto.password,
          name: dto.name,
          role: dto.role,
          ...(dto.company_id !== undefined ? { companyId: dto.company_id } : {}),
        });

        reply.code(201).send(toUserResponse(user));
      } catch (error) {
        if (error instanceof ForbiddenCompanyScopeError) {
          reply.code(403).send({ error: "forbidden", message: error.message });
          return;
        }
        if (error instanceof EmailConflictError) {
          reply.code(409).send({ error: "email_conflict", message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  app.patch(
    "/users/:id",
    {
      schema: {
        params: userParamsSchema,
        body: updateUserBodySchema,
        response: {
          200: userResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const dto = request.body;
      const { actor } = request;

      try {
        const user = await deps.updateUser({
          actorRole: actor.role,
          ...(actor.companyId !== undefined ? { actorCompanyId: actor.companyId } : {}),
          id,
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.password !== undefined ? { password: dto.password } : {}),
        });

        reply.code(200).send(toUserResponse(user));
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          reply.code(404).send({ error: "user_not_found", message: error.message });
          return;
        }
        if (error instanceof ForbiddenCompanyScopeError) {
          reply.code(403).send({ error: "forbidden", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
