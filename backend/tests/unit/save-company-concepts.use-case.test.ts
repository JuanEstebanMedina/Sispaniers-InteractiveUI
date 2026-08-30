import { expect, test } from "vitest";
import {
  createSaveCompanyConceptDefinitionsUseCase,
  createSaveCompanyConceptObservationsUseCase,
} from "../../src/application/use-cases/dashboard/save-company-concepts.use-case.js";
import type {
  CompanyConcept,
  CompanyConceptObservation,
  CompanyConceptResult,
} from "../../src/domain/logistics/company-concept.js";
import type { CompanyConceptRepository } from "../../src/domain/ports/company-concept.repository.js";

function buildRepository(): CompanyConceptRepository & {
  definitions: CompanyConcept[];
  observations: CompanyConceptObservation[];
} {
  const definitions: CompanyConcept[] = [];
  const observations: CompanyConceptObservation[] = [];

  return {
    definitions,
    observations,
    findForCompany: async (): Promise<CompanyConceptResult[]> => [],
    findDefinitions: async (companyId, conceptIds) =>
      definitions.filter(
        (concept) => concept.companyId === companyId && conceptIds.includes(concept.id),
      ),
    saveDefinitions: async (concepts) => {
      definitions.push(...concepts);
    },
    saveObservations: async (nextObservations) => {
      observations.push(...nextObservations);
    },
  };
}

test("stores concept definitions under supplied company", async () => {
  const repository = buildRepository();
  const saveDefinitions = createSaveCompanyConceptDefinitionsUseCase({
    companyConceptRepository: repository,
  });

  await saveDefinitions({
    companyId: "company-1",
    concepts: [{ id: "volume", name: "Monthly volume" }],
  });

  expect(repository.definitions).toEqual([
    { id: "volume", name: "Monthly volume", companyId: "company-1" },
  ]);
});

test("only records observations for concepts owned by company", async () => {
  const repository = buildRepository();
  repository.definitions.push({ id: "volume", name: "Monthly volume", companyId: "company-1" });
  const saveObservations = createSaveCompanyConceptObservationsUseCase({
    companyConceptRepository: repository,
  });

  await saveObservations({
    companyId: "company-1",
    observations: [
      {
        id: "event-1",
        conceptId: "volume",
        observedAt: new Date("2026-08-30T00:00:00.000Z"),
        value: { value: 42 },
      },
    ],
  });

  expect(repository.observations).toHaveLength(1);
  expect(repository.observations[0]?.companyId).toBe("company-1");
});

test("rejects observations for unknown concepts", async () => {
  const saveObservations = createSaveCompanyConceptObservationsUseCase({
    companyConceptRepository: buildRepository(),
  });

  await expect(
    saveObservations({
      companyId: "company-1",
      observations: [
        {
          id: "event-1",
          conceptId: "unknown",
          observedAt: new Date("2026-08-30T00:00:00.000Z"),
          value: { value: 42 },
        },
      ],
    }),
  ).rejects.toThrow("observations reference an unknown company concept");
});
