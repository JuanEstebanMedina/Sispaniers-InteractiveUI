import type { Company } from "../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";

export interface ListCompaniesDeps {
  companyRepository: CompanyRepository;
}

export function createListCompaniesUseCase(deps: ListCompaniesDeps) {
  const { companyRepository } = deps;

  return async function listCompanies(): Promise<Company[]> {
    return companyRepository.findAll();
  };
}
