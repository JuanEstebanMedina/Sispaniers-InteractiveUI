import { expect, test } from "vitest";
import { createListCompaniesUseCase } from "../../src/application/use-cases/dashboard/list-companies.use-case.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { aCompany } from "../support/operation-fixtures.js";

test("an empty repository lists no companies", async () => {
  const listCompanies = createListCompaniesUseCase({
    companyRepository: new InMemoryCompanyRepository(),
  });

  expect(await listCompanies()).toEqual([]);
});

test("every saved company is listed", async () => {
  const companyRepository = new InMemoryCompanyRepository();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles" }));
  await companyRepository.save(aCompany({ id: "company-2", name: "Muebles del Sur" }));

  const listCompanies = createListCompaniesUseCase({ companyRepository });
  const companies = await listCompanies();

  expect(companies.map((company) => company.id).sort()).toEqual(["company-1", "company-2"]);
});
