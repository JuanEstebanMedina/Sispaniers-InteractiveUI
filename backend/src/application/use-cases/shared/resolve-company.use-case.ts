import type { Company } from "../../../domain/logistics/company.js";
import { CompanyNotFoundError } from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type {
  CreateCompanyInput,
  CreateCompanyResult,
} from "../dashboard/create-company.use-case.js";

export interface ResolveCompanyInput {
  companyId?: string;
  companyName?: string;
  contactEmails?: string[];
}

export interface ResolveCompanyDeps {
  companyRepository: CompanyRepository;
  createCompany: (input: CreateCompanyInput) => Promise<CreateCompanyResult>;
}

/**
 * Shared by every caller that accepts either an existing company id or a
 * name to find-or-create by — create-operation and the email intake both
 * need this same "resolve, don't just validate" behaviour.
 */
export type ResolveCompany = (input: ResolveCompanyInput) => Promise<Company | undefined>;

export function createResolveCompanyUseCase(deps: ResolveCompanyDeps): ResolveCompany {
  const { companyRepository, createCompany } = deps;

  return async function resolveCompany(input: ResolveCompanyInput): Promise<Company | undefined> {
    if (input.companyId !== undefined) {
      const company = await companyRepository.findById(input.companyId);
      if (company === null) {
        throw new CompanyNotFoundError(input.companyId);
      }
      return company;
    }

    if (input.companyName !== undefined) {
      const { company } = await createCompany({
        name: input.companyName,
        ...(input.contactEmails !== undefined ? { contactEmails: input.contactEmails } : {}),
      });
      return company;
    }

    return undefined;
  };
}
