import { expect, test } from "vitest";
import { createUpdateCompanyUseCase } from "../../src/application/use-cases/dashboard/update-company.use-case.js";
import { CompanyNameConflictError, CompanyNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { aCompany } from "../support/operation-fixtures.js";

function useCaseOver() {
  const companyRepository = new InMemoryCompanyRepository();
  return { companyRepository, updateCompany: createUpdateCompanyUseCase({ companyRepository }) };
}

test("an unknown id is rejected", async () => {
  const { updateCompany } = useCaseOver();

  await expect(updateCompany({ id: "ghost", name: "New Name" })).rejects.toThrow(
    CompanyNotFoundError,
  );
});

test("a partial update keeps the fields not mentioned", async () => {
  const { companyRepository, updateCompany } = useCaseOver();
  await companyRepository.save(
    aCompany({
      id: "company-1",
      name: "Andes Textiles",
      contactEmails: ["ops@andestextiles.co"],
      preferredNotificationChannel: "email",
    }),
  );

  const updated = await updateCompany({ id: "company-1", preferredNotificationChannel: "slack" });

  expect(updated.name).toBe("Andes Textiles");
  expect(updated.contactEmails).toEqual(["ops@andestextiles.co"]);
  expect(updated.preferredNotificationChannel).toBe("slack");
});

test("renaming to a name already used by another company is rejected", async () => {
  const { companyRepository, updateCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles" }));
  await companyRepository.save(aCompany({ id: "company-2", name: "Muebles del Sur" }));

  await expect(updateCompany({ id: "company-2", name: "andes textiles" })).rejects.toThrow(
    CompanyNameConflictError,
  );
});

test("renaming to the same name (different case) is a no-op, not a conflict with itself", async () => {
  const { companyRepository, updateCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles" }));

  const updated = await updateCompany({ id: "company-1", name: "ANDES TEXTILES" });

  expect(updated.name).toBe("ANDES TEXTILES");
});

test("disabling a company keeps every other field untouched", async () => {
  const { companyRepository, updateCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", name: "Andes Textiles", active: true }));

  const updated = await updateCompany({ id: "company-1", active: false });

  expect(updated.active).toBe(false);
  expect(updated.name).toBe("Andes Textiles");
});

test("re-enabling a disabled company", async () => {
  const { companyRepository, updateCompany } = useCaseOver();
  await companyRepository.save(aCompany({ id: "company-1", active: false }));

  const updated = await updateCompany({ id: "company-1", active: true });

  expect(updated.active).toBe(true);
});
