import type { Company } from "../../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../../domain/ports/company.repository.js";

export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly companies = new Map<string, Company>();

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) ?? null;
  }

  async findByName(name: string): Promise<Company | null> {
    const target = name.trim().toLowerCase();

    for (const company of this.companies.values()) {
      if (company.name.trim().toLowerCase() === target) {
        return company;
      }
    }

    return null;
  }

  async findByContactEmail(email: string): Promise<Company | null> {
    const target = email.trim().toLowerCase();

    for (const company of this.companies.values()) {
      if (company.contactEmails.some((candidate) => candidate.trim().toLowerCase() === target)) {
        return company;
      }
    }

    return null;
  }

  async findAll(): Promise<Company[]> {
    return [...this.companies.values()];
  }

  async save(company: Company): Promise<void> {
    this.companies.set(company.id, company);
  }
}
