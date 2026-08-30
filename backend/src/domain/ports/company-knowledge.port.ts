export interface CompanyKnowledgePort {
  query(companyId: string, topic?: string): Promise<string[]>;
}
