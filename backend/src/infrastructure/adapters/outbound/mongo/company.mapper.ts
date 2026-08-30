import type { Company } from "../../../../domain/logistics/company.js";

export type CompanyDocument = Omit<Company, "id"> & { _id: string };

export function toCompanyDocument({ id, ...rest }: Company): CompanyDocument {
  return { _id: id, ...rest };
}

export function toCompany({ _id, ...rest }: CompanyDocument): Company {
  return { id: _id, ...rest };
}
