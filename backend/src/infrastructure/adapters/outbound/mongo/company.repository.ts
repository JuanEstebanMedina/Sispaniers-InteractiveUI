import type { Collection, Db } from "mongodb";
import type { Company } from "../../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../../domain/ports/company.repository.js";
import { type CompanyDocument, toCompany, toCompanyDocument } from "./company.mapper.js";

const COLLECTION_NAME = "companies";

export class MongoCompanyRepository implements CompanyRepository {
  private readonly companies: Collection<CompanyDocument>;

  constructor(db: Db) {
    this.companies = db.collection<CompanyDocument>(COLLECTION_NAME);
  }

  async findById(id: string): Promise<Company | null> {
    const document = await this.companies.findOne({ _id: id });

    return document === null ? null : toCompany(document);
  }

  async findByName(name: string): Promise<Company | null> {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const document = await this.companies.findOne({
      name: { $regex: `^${escaped}$`, $options: "i" },
    });

    return document === null ? null : toCompany(document);
  }

  async findByContactEmail(email: string): Promise<Company | null> {
    const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const document = await this.companies.findOne({
      contactEmails: { $regex: `^${escaped}$`, $options: "i" },
    });

    return document === null ? null : toCompany(document);
  }

  async findAll(): Promise<Company[]> {
    const documents = await this.companies.find({}).toArray();

    return documents.map(toCompany);
  }

  async save(company: Company): Promise<void> {
    const document = toCompanyDocument(company);

    await this.companies.replaceOne({ _id: document._id }, document, { upsert: true });
  }
}
