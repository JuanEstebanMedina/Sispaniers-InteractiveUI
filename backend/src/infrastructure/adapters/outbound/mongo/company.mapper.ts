import type { Company } from "../../../../domain/logistics/company.js";

export type CompanyDocument = Omit<Company, "id" | "active" | "generalContext"> & {
  _id: string;
  active?: boolean;
  generalContext?: string[];
};

export function toCompanyDocument({ id, ...rest }: Company): CompanyDocument {
  return { _id: id, ...rest };
}

export function toCompany({ _id, active, generalContext, ...rest }: CompanyDocument): Company {
  // Documents saved before this field existed have no `active` at all —
  // nothing has ever been disabled, so absent means active.
  return { id: _id, active: active ?? true, generalContext: generalContext ?? [], ...rest };
}
