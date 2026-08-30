import type {
  CompanyConcept,
  CompanyConceptObservation,
  CompanyConceptResult,
} from "../logistics/company-concept.js";

export interface CompanyConceptRepository {
  findForCompany(companyId: string, conceptIds: string[]): Promise<CompanyConceptResult[]>;
  findDefinitions(companyId: string, conceptIds: string[]): Promise<CompanyConcept[]>;
  saveDefinitions(concepts: CompanyConcept[]): Promise<void>;
  saveObservations(observations: CompanyConceptObservation[]): Promise<void>;
}
