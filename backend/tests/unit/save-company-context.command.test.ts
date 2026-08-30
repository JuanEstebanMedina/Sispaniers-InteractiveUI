import { expect, test } from "vitest";
import { createSaveCompanyContextCommand } from "../../src/application/commands/save-company-context.command.js";
import { createSaveCompanyContextUseCase } from "../../src/application/use-cases/dashboard/save-company-context.use-case.js";
import type { Company } from "../../src/domain/logistics/company.js";
import type { Operation } from "../../src/domain/logistics/operation.js";

test("save_company_context persists one company fact without duplicates", async () => {
  const company: Company = {
    id: "company-1",
    name: "Acme",
    contactEmails: [],
    preferredNotificationChannel: "email",
    generalContext: [],
    active: true,
  };
  const saveCompanyContext = createSaveCompanyContextUseCase({
    operationRepository: {
      findById: async () => ({ id: "op-1", companyId: company.id }) as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    companyRepository: {
      findById: async () => company,
      findByName: async () => null,
      findByContactEmail: async () => null,
      findAll: async () => [],
      save: async (updated) => Object.assign(company, updated),
    },
  });
  const command = createSaveCompanyContextCommand({ saveCompanyContext });
  const input = { context: "Preferimos salida semanal.", reply: "Guardado." };

  await command.execute(input, { operationId: "op-1" });
  await command.execute(input, { operationId: "op-1" });

  expect(company.generalContext).toEqual(["Preferimos salida semanal."]);
});
