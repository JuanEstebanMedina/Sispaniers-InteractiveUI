import { expect, test } from "vitest";
import { createCreateCompanyUseCase } from "../../src/application/use-cases/dashboard/create-company.use-case.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";

function useCaseOver(companyRepository = new InMemoryCompanyRepository()) {
  let counter = 0;
  return {
    companyRepository,
    createCompany: createCreateCompanyUseCase({
      companyRepository,
      idGenerator: { newId: () => `company-${++counter}` },
    }),
  };
}

test("a new name creates a company with defaults filled in", async () => {
  const { createCompany } = useCaseOver();

  const { company, created } = await createCompany({ name: "Andes Textiles" });

  expect(created).toBe(true);
  expect(company.id).toBe("company-1");
  expect(company.contactEmails).toEqual([]);
  expect(company.preferredNotificationChannel).toBe("email");
  expect(company.active).toBe(true);
});

test("an existing name (case-insensitive) is reused instead of duplicated", async () => {
  const { createCompany, companyRepository } = useCaseOver();

  const first = await createCompany({ name: "Andes Textiles" });
  const second = await createCompany({ name: "andes textiles" });

  expect(second.created).toBe(false);
  expect(second.company.id).toBe(first.company.id);
  expect(await companyRepository.findAll()).toHaveLength(1);
});

test("explicit contact emails and channel are kept on creation", async () => {
  const { createCompany } = useCaseOver();

  const { company } = await createCompany({
    name: "Andes Textiles",
    contactEmails: ["ops@andestextiles.co"],
    preferredNotificationChannel: "slack",
  });

  expect(company.contactEmails).toEqual(["ops@andestextiles.co"]);
  expect(company.preferredNotificationChannel).toBe("slack");
});
