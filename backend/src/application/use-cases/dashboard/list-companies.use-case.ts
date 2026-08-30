import type { Company } from "../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";

export interface ListCompaniesInput {
  scopeCompanyId?: string;
}

export interface ListCompaniesDeps {
  companyRepository: CompanyRepository;
}

export function createListCompaniesUseCase(deps: ListCompaniesDeps) {
  const { companyRepository } = deps;

  return async function listCompanies(input: ListCompaniesInput = {}): Promise<Company[]> {
    const companies = await companyRepository.findAll();

    if (input.scopeCompanyId === undefined) {
      return companies;
    }

    return companies.filter((company) => company.id === input.scopeCompanyId);
  };
}
