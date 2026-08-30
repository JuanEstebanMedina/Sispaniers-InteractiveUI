import type { Company } from "../../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../../domain/ports/company.repository.js";

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly companies = new Map<string, Company>();

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) ?? null;
  }

  async findAll(): Promise<Company[]> {
    return [...this.companies.values()];
  }

  async save(company: Company): Promise<void> {
    this.companies.set(company.id, company);
  }
}
