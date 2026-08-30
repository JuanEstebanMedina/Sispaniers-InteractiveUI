import { CompanyNotFoundError, OperationNotFoundError } from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface SaveCompanyContextInput {
  operationId: string;
  context: string;
}

export interface SaveCompanyContextDeps {
  operationRepository: OperationRepository;
  companyRepository: CompanyRepository;
}

export function createSaveCompanyContextUseCase(deps: SaveCompanyContextDeps) {
  const { operationRepository, companyRepository } = deps;

  return async function saveCompanyContext(input: SaveCompanyContextInput): Promise<string> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }
    if (operation.companyId === undefined) {
      throw new CompanyNotFoundError(`for operation ${input.operationId}`);
    }

    const company = await companyRepository.findById(operation.companyId);
    if (company === null) {
      throw new CompanyNotFoundError(operation.companyId);
    }

    const context = input.context.trim();
    if (!company.generalContext.includes(context)) {
      await companyRepository.save({
        ...company,
        generalContext: [...company.generalContext, context],
      });
    }
    return context;
  };
}
