import { expect, test } from "vitest";
import { createCreateCompanyUseCase } from "../../src/application/use-cases/dashboard/create-company.use-case.js";
import { createResolveCompanyUseCase } from "../../src/application/use-cases/shared/resolve-company.use-case.js";
import { CompanyNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { aCompany } from "../support/operation-fixtures.js";

function useCaseOver() {
  const companyRepository = new InMemoryCompanyRepository();
  const createCompany = createCreateCompanyUseCase({
    companyRepository,
    idGenerator: { newId: () => "company-new" },
  });
  return {
    companyRepository,
    resolveCompany: createResolveCompanyUseCase({ companyRepository, createCompany }),
  };
}

test("an explicit companyId resolves the existing company", async () => {
  const { companyRepository, resolveCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles" }));

  const company = await resolveCompany({ companyId: "company-1" });

  expect(company?.id).toBe("company-1");
});

test("an unknown companyId is rejected, not silently created", async () => {
  const { resolveCompany } = useCaseOver();

  await expect(resolveCompany({ companyId: "ghost" })).rejects.toThrow(CompanyNotFoundError);
});

test("a companyName finds an existing company by name", async () => {
  const { companyRepository, resolveCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles" }));

  const company = await resolveCompany({ companyName: "andes textiles" });

  expect(company?.id).toBe("company-1");
});

test("a companyName with no match creates a new company", async () => {
  const { resolveCompany, companyRepository } = useCaseOver();

  const company = await resolveCompany({
    companyName: "Nuevo Cliente",
    contactEmails: ["ops@nuevocliente.co"],
  });

  expect(company?.id).toBe("company-new");
  expect(await companyRepository.findByName("Nuevo Cliente")).not.toBeNull();
});

test("neither companyId nor companyName leaves the company unresolved", async () => {
  const { resolveCompany } = useCaseOver();

  const company = await resolveCompany({});

  expect(company).toBeUndefined();
});
