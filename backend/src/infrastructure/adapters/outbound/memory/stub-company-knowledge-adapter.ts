import type { CompanyKnowledgePort } from "../../../../domain/ports/company-knowledge.port.js";

// ponytail: stub, real retrieval (indexing/storage/search) lands in a
// separate PR — this only wires the port so callers don't touch use-case
// code when that PR swaps the adapter in.
export class StubCompanyKnowledgeAdapter implements CompanyKnowledgePort {
  async query(_companyId: string, _topic?: string): Promise<string[]> {
    return [];
  }
}
