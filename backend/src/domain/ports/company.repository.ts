import type { Company } from "../logistics/company.js";

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  findAll(): Promise<Company[]>;
  save(company: Company): Promise<void>;
}
