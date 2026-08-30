import type {
  CompanyConcept,
  CompanyConceptObservation,
} from "../../../domain/logistics/company-concept.js";
import { InvalidCompanyConceptError } from "../../../domain/model/errors.js";
import type { CompanyConceptRepository } from "../../../domain/ports/company-concept.repository.js";

export interface SaveCompanyConceptDefinitionsInput {
  companyId: string;
  concepts: Array<Pick<CompanyConcept, "id" | "name">>;
}

export interface SaveCompanyConceptObservationsInput {
  companyId: string;
  observations: Array<Omit<CompanyConceptObservation, "companyId">>;
}

export interface SaveCompanyConceptsDeps {
  companyConceptRepository: CompanyConceptRepository;
}

function requireIds(companyId: string, ids: string[]): void {
  if (!companyId || ids.some((id) => !id)) {
    throw new InvalidCompanyConceptError("company and concept ids are required");
  }
  if (new Set(ids).size !== ids.length) {
    throw new InvalidCompanyConceptError("concept ids must be unique within a batch");
  }
}

export function createSaveCompanyConceptDefinitionsUseCase(deps: SaveCompanyConceptsDeps) {
  const { companyConceptRepository } = deps;

  return async function saveCompanyConceptDefinitions(
    input: SaveCompanyConceptDefinitionsInput,
  ): Promise<void> {
    requireIds(
      input.companyId,
      input.concepts.map((concept) => concept.id),
    );
    if (input.concepts.some((concept) => !concept.name.trim())) {
      throw new InvalidCompanyConceptError("concept names are required");
    }

    await companyConceptRepository.saveDefinitions(
      input.concepts.map((concept) => ({ ...concept, companyId: input.companyId })),
    );
  };
}

export function createSaveCompanyConceptObservationsUseCase(deps: SaveCompanyConceptsDeps) {
  const { companyConceptRepository } = deps;

  return async function saveCompanyConceptObservations(
    input: SaveCompanyConceptObservationsInput,
  ): Promise<void> {
    requireIds(
      input.companyId,
      input.observations.map((observation) => observation.id),
    );

    const conceptIds = input.observations.map((observation) => observation.conceptId);
    const definitions = await companyConceptRepository.findDefinitions(input.companyId, conceptIds);
    if (definitions.length !== new Set(conceptIds).size) {
      throw new InvalidCompanyConceptError("observations reference an unknown company concept");
    }

    await companyConceptRepository.saveObservations(
      input.observations.map((observation) => ({ ...observation, companyId: input.companyId })),
    );
  };
}
