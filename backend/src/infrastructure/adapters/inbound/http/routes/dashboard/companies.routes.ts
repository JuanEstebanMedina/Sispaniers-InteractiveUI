import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type {
  CreateCompanyInput,
  CreateCompanyResult,
} from "../../../../../../application/use-cases/dashboard/create-company.use-case.js";
import type { ListCompaniesInput } from "../../../../../../application/use-cases/dashboard/list-companies.use-case.js";
import type { UpdateCompanyInput } from "../../../../../../application/use-cases/dashboard/update-company.use-case.js";
import type { Company } from "../../../../../../domain/logistics/company.js";
import {
  CompanyNameConflictError,
  CompanyNotFoundError,
} from "../../../../../../domain/model/errors.js";
import {
  companyResponseSchema,
  createCompanyBodySchema,
  listCompaniesResponseSchema,
  updateCompanyBodySchema,
} from "../../schemas/company.schema.js";
import { errorResponseSchema } from "../../schemas/error.schema.js";

const companyParamsSchema = z.object({ id: z.string().min(1) });

export interface CompaniesRouteDeps {
  createCompany: (input: CreateCompanyInput) => Promise<CreateCompanyResult>;
  listCompanies: (input: ListCompaniesInput) => Promise<Company[]>;
  updateCompany: (input: UpdateCompanyInput) => Promise<Company>;
}

function toCompanyResponse(company: Company) {
  return {
    id: company.id,
    name: company.name,
    contact_emails: company.contactEmails,
    preferred_notification_channel: company.preferredNotificationChannel,
    active: company.active,
  };
}

export const companiesRoutes: FastifyPluginAsyncZod<CompaniesRouteDeps> = async (fastify, deps) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    "/companies",
    { schema: { response: { 200: listCompaniesResponseSchema } } },
    async (request, reply) => {
      const { actor } = request;
      const scopeCompanyId = actor.role === "superadmin" ? undefined : actor.companyId;

      const companies = await deps.listCompanies({
        ...(scopeCompanyId !== undefined ? { scopeCompanyId } : {}),
      });
      reply.code(200).send({ companies: companies.map(toCompanyResponse) });
    },
  );

  // Idempotent by name: an existing company is returned with 200 instead of
  // creating a duplicate — see create-company.use-case.ts.
  app.post(
    "/companies",
    {
      schema: {
        body: createCompanyBodySchema,
        response: {
          200: companyResponseSchema,
          201: companyResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.actor.role !== "superadmin") {
        reply
          .code(403)
          .send({ error: "forbidden", message: "Only superadmin can manage companies" });
        return;
      }

      const dto = request.body;

      const result = await deps.createCompany({
        name: dto.name,
        ...(dto.contact_emails !== undefined ? { contactEmails: dto.contact_emails } : {}),
        ...(dto.preferred_notification_channel !== undefined
          ? { preferredNotificationChannel: dto.preferred_notification_channel }
          : {}),
      });

      reply.code(result.created ? 201 : 200).send(toCompanyResponse(result.company));
    },
  );

  // No DELETE: a company is never removed, only disabled via `active: false`
  // on this same PATCH — see the note on `Company.active`. That keeps its
  // data, and every operation that references it, intact.
  app.patch(
    "/companies/:id",
    {
      schema: {
        params: companyParamsSchema,
        body: updateCompanyBodySchema,
        response: {
          200: companyResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (request.actor.role !== "superadmin") {
        reply
          .code(403)
          .send({ error: "forbidden", message: "Only superadmin can manage companies" });
        return;
      }

      const { id } = request.params;
      const dto = request.body;

      try {
        const company = await deps.updateCompany({
          id,
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.contact_emails !== undefined ? { contactEmails: dto.contact_emails } : {}),
          ...(dto.preferred_notification_channel !== undefined
            ? { preferredNotificationChannel: dto.preferred_notification_channel }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        });

        reply.code(200).send(toCompanyResponse(company));
      } catch (error) {
        if (error instanceof CompanyNotFoundError) {
          reply.code(404).send({ error: "company_not_found", message: error.message });
          return;
        }
        if (error instanceof CompanyNameConflictError) {
          reply.code(409).send({ error: "company_name_conflict", message: error.message });
          return;
        }
        throw error;
      }
    },
  );
};
