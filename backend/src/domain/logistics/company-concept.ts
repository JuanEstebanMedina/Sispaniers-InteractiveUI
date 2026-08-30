export interface CompanyConcept {
  id: string;
  companyId: string;
  name: string;
}

export interface CompanyConceptObservation {
  id: string;
  companyId: string;
  conceptId: string;
  observedAt: Date;
  value: Record<string, unknown>;
}

export interface CompanyConceptResult {
  id: string;
  name: string;
  values: Array<Record<string, unknown> & { observedAt: string }>;
}
