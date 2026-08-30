import type { Company } from "../logistics/company.js";

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  /** Case-insensitive exact match — the idempotency key for company creation. */
  findByName(name: string): Promise<Company | null>;
  /** Case-insensitive match against any of the company's `contactEmails`. */
  findByContactEmail(email: string): Promise<Company | null>;
  findAll(): Promise<Company[]>;
  save(company: Company): Promise<void>;
}
