import { expect, test } from "vitest";
import { createQueryCompanyConceptsUseCase } from "../../src/application/use-cases/dashboard/query-company-concepts.use-case.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import type { CompanyConceptRepository } from "../../src/domain/ports/company-concept.repository.js";
import type { OperationRepository } from "../../src/domain/ports/operation.repository.js";

const operationRepository: OperationRepository = {
  findById: async () => ({ id: "op-1", companyId: "company-1" }) as Operation,
  findAll: async () => [],
  save: async () => {},
};

test("queries only current operation company", async () => {
  let companyId = "";
  let conceptIds: string[] = [];
  const companyConceptRepository: CompanyConceptRepository = {
    findForCompany: async (receivedCompanyId, receivedConceptIds) => {
      companyId = receivedCompanyId;
      conceptIds = receivedConceptIds;
      return [{ id: "volume", name: "Volume", values: [] }];
    },
    findDefinitions: async () => [],
    saveDefinitions: async () => {},
    saveObservations: async () => {},
  };
  const queryCompanyConcepts = createQueryCompanyConceptsUseCase({
    operationRepository,
    companyConceptRepository,
  });

  await expect(
    queryCompanyConcepts({ operationId: "op-1", conceptIds: ["volume"] }),
  ).resolves.toEqual([{ id: "volume", name: "Volume", values: [] }]);
  expect(companyId).toBe("company-1");
  expect(conceptIds).toEqual(["volume"]);
});

test("does not query when operation has no company", async () => {
  const noCompanyOperationRepository: OperationRepository = {
    ...operationRepository,
    findById: async () => ({ id: "op-1" }) as Operation,
  };
  const companyConceptRepository: CompanyConceptRepository = {
    findForCompany: async () => {
      throw new Error("must not query concepts without a company");
    },
    findDefinitions: async () => [],
    saveDefinitions: async () => {},
    saveObservations: async () => {},
  };
  const queryCompanyConcepts = createQueryCompanyConceptsUseCase({
    operationRepository: noCompanyOperationRepository,
    companyConceptRepository,
  });

  await expect(
    queryCompanyConcepts({ operationId: "op-1", conceptIds: ["volume"] }),
  ).resolves.toEqual([]);
});

test("rejects another company's operation", async () => {
  const companyConceptRepository: CompanyConceptRepository = {
    findForCompany: async () => [],
    findDefinitions: async () => [],
    saveDefinitions: async () => {},
    saveObservations: async () => {},
  };
  const queryCompanyConcepts = createQueryCompanyConceptsUseCase({
    operationRepository,
    companyConceptRepository,
  });

  await expect(
    queryCompanyConcepts({
      operationId: "op-1",
      conceptIds: ["volume"],
      requesterCompanyId: "company-2",
    }),
  ).rejects.toThrow("Actor cannot act outside their own company");
});
