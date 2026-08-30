import type { NotificationChannel } from "../../../domain/enums/notification-channel.js";
import type { Company } from "../../../domain/logistics/company.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface CreateCompanyInput {
  name: string;
  contactEmails?: string[];
  preferredNotificationChannel?: NotificationChannel;
}

export interface CreateCompanyResult {
  company: Company;
  created: boolean;
}

export interface CreateCompanyDeps {
  companyRepository: CompanyRepository;
  idGenerator: IdGenerator;
}

export function createCreateCompanyUseCase(deps: CreateCompanyDeps) {
  const { companyRepository, idGenerator } = deps;

  return async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
    const existing = await companyRepository.findByName(input.name);
    if (existing !== null) {
      return { company: existing, created: false };
    }

    const company: Company = {
      id: idGenerator.newId(),
      name: input.name,
      contactEmails: input.contactEmails ?? [],
      preferredNotificationChannel: input.preferredNotificationChannel ?? "email",
      active: true,
    };

    await companyRepository.save(company);

    return { company, created: true };
  };
}
