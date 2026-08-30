import type { CompanyConceptResult } from "../../../domain/logistics/company-concept.js";
import {
  ForbiddenCompanyScopeError,
  OperationNotFoundError,
} from "../../../domain/model/errors.js";
import type { CompanyConceptRepository } from "../../../domain/ports/company-concept.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface QueryCompanyConceptsInput {
  operationId: string;
  conceptIds: string[];
  requesterCompanyId?: string;
}

export interface QueryCompanyConceptsDeps {
  operationRepository: OperationRepository;
  companyConceptRepository: CompanyConceptRepository;
}

export function createQueryCompanyConceptsUseCase(deps: QueryCompanyConceptsDeps) {
  const { operationRepository, companyConceptRepository } = deps;

  return async function queryCompanyConcepts(
    input: QueryCompanyConceptsInput,
  ): Promise<CompanyConceptResult[]> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    // An unassigned operation cannot safely read another company's concepts.
    if (operation.companyId === undefined) {
      return [];
    }
    if (
      input.requesterCompanyId !== undefined &&
      input.requesterCompanyId !== operation.companyId
    ) {
      throw new ForbiddenCompanyScopeError();
    }

    return companyConceptRepository.findForCompany(operation.companyId, input.conceptIds);
  };
}
