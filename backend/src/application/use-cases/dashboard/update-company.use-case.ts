import type { NotificationChannel } from "../../../domain/enums/notification-channel.js";
import type { Company } from "../../../domain/logistics/company.js";
import { CompanyNameConflictError, CompanyNotFoundError } from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";

export interface UpdateCompanyInput {
  id: string;
  name?: string;
  contactEmails?: string[];
  preferredNotificationChannel?: NotificationChannel;
  /** Disable/re-enable — see the note on `Company.active`. */
  active?: boolean;
}

export interface UpdateCompanyDeps {
  companyRepository: CompanyRepository;
}

export function createUpdateCompanyUseCase(deps: UpdateCompanyDeps) {
  const { companyRepository } = deps;

  return async function updateCompany(input: UpdateCompanyInput): Promise<Company> {
    const company = await companyRepository.findById(input.id);
    if (company === null) {
      throw new CompanyNotFoundError(input.id);
    }

    if (
      input.name !== undefined &&
      input.name.trim().toLowerCase() !== company.name.toLowerCase()
    ) {
      const existing = await companyRepository.findByName(input.name);
      if (existing !== null && existing.id !== company.id) {
        throw new CompanyNameConflictError(input.name);
      }
    }

    const updated: Company = {
      ...company,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactEmails !== undefined ? { contactEmails: input.contactEmails } : {}),
      ...(input.preferredNotificationChannel !== undefined
        ? { preferredNotificationChannel: input.preferredNotificationChannel }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };

    await companyRepository.save(updated);

    return updated;
  };
}
