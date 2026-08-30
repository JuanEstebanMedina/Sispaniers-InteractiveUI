import { expect, test } from "vitest";
import { createIngestCompanyConceptsUseCase } from "../../src/application/use-cases/dashboard/ingest-company-concepts.use-case.js";
import type {
  CompanyConcept,
  CompanyConceptObservation,
} from "../../src/domain/logistics/company-concept.js";
import type { CompanyConceptRepository } from "../../src/domain/ports/company-concept.repository.js";

function repository(): CompanyConceptRepository & {
  definitions: CompanyConcept[];
  observations: CompanyConceptObservation[];
} {
  const definitions: CompanyConcept[] = [];
  const observations: CompanyConceptObservation[] = [];
  return {
    definitions,
    observations,
    findForCompany: async () => [],
    findDefinitions: async (companyId, conceptIds) =>
      definitions.filter(
        (concept) => concept.companyId === companyId && conceptIds.includes(concept.id),
      ),
    saveDefinitions: async (next) => definitions.push(...next),
    saveObservations: async (next) => observations.push(...next),
  };
}

test("stores inbound definitions before their observations", async () => {
  const companyConceptRepository = repository();
  const ingestCompanyConcepts = createIngestCompanyConceptsUseCase({
    operationRepository: {
      findById: async () => ({ id: "op-1", companyId: "company-1" }),
      findAll: async () => [],
      save: async () => {},
    },
    companyConceptRepository,
  });

  await expect(
    ingestCompanyConcepts({
      operationId: "op-1",
      definitions: [{ id: "monthly-volume", name: "Monthly volume" }],
      observations: [
        {
          conceptId: "monthly-volume",
          observedAt: "2026-08-30T12:00:00.000Z",
          value: { units: 42 },
        },
      ],
    }),
  ).resolves.toEqual({ definitions: 1, observations: 1 });
  expect(companyConceptRepository.definitions).toEqual([
    { id: "monthly-volume", name: "Monthly volume", companyId: "company-1" },
  ]);
  expect(companyConceptRepository.observations).toHaveLength(1);
});
