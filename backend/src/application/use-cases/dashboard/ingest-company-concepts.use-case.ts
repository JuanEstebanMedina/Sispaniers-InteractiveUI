import { createHash } from "node:crypto";
import type { CompanyConceptObservation } from "../../../domain/logistics/company-concept.js";
import {
  InvalidCompanyConceptError,
  OperationNotFoundError,
} from "../../../domain/model/errors.js";
import type { CompanyConceptRepository } from "../../../domain/ports/company-concept.repository.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import {
  createSaveCompanyConceptDefinitionsUseCase,
  createSaveCompanyConceptObservationsUseCase,
} from "./save-company-concepts.use-case.js";

export interface IngestCompanyConceptsInput {
  operationId: string;
  definitions: Array<{ id: string; name: string }>;
  observations: Array<{
    conceptId: string;
    observedAt: string;
    value: Record<string, unknown>;
  }>;
}

export interface IngestCompanyConceptsDeps {
  operationRepository: OperationRepository;
  companyConceptRepository: CompanyConceptRepository;
}

function observationId(
  companyId: string,
  conceptId: string,
  observedAt: Date,
  value: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ companyId, conceptId, observedAt: observedAt.toISOString(), value }))
    .digest("hex");
}

function toObservations(
  companyId: string,
  observations: IngestCompanyConceptsInput["observations"],
): Array<Omit<CompanyConceptObservation, "companyId">> {
  return observations.map((observation) => {
    const observedAt = new Date(observation.observedAt);
    if (Number.isNaN(observedAt.getTime())) {
      throw new InvalidCompanyConceptError("observation timestamps must be valid ISO dates");
    }
    return {
      id: observationId(companyId, observation.conceptId, observedAt, observation.value),
      conceptId: observation.conceptId,
      observedAt,
      value: observation.value,
    };
  });
}

export function createIngestCompanyConceptsUseCase(deps: IngestCompanyConceptsDeps) {
  const { operationRepository, companyConceptRepository } = deps;
  const saveDefinitions = createSaveCompanyConceptDefinitionsUseCase({ companyConceptRepository });
  const saveObservations = createSaveCompanyConceptObservationsUseCase({
    companyConceptRepository,
  });

  return async function ingestCompanyConcepts(input: IngestCompanyConceptsInput) {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }
    if (operation.companyId === undefined) {
      return { definitions: 0, observations: 0 };
    }

    await saveDefinitions({ companyId: operation.companyId, concepts: input.definitions });
    await saveObservations({
      companyId: operation.companyId,
      observations: toObservations(operation.companyId, input.observations),
    });
    return { definitions: input.definitions.length, observations: input.observations.length };
  };
}
