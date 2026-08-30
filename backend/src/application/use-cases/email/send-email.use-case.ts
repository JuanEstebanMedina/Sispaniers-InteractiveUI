import { CompanyDisabledError, EmailSendError } from "../../../domain/model/errors.js";
import type { CompanyRepository } from "../../../domain/ports/company.repository.js";
import type { EmailSender } from "../../../domain/ports/email-sender.port.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";

export interface SendEmailInput {
  runId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  inReplyTo?: string;
}

export interface SendEmailResult {
  emailId: string;
  providerMessageId?: string;
}

export interface SendEmailDeps {
  emailSender: EmailSender;
  idGenerator: IdGenerator;
  companyRepository: CompanyRepository;
}

export function createSendEmailUseCase(deps: SendEmailDeps) {
  const { emailSender, idGenerator, companyRepository } = deps;

  return async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    // A recipient that isn't any company's contact (a carrier, a colleague)
    // sends through untouched — this only blocks a company we know is
    // disabled, not every address we don't recognize.
    const company = await companyRepository.findByContactEmail(input.to);
    if (company !== null && !company.active) {
      throw new CompanyDisabledError(input.to);
    }

    try {
      const result = await emailSender.send({
        to: input.to,
        subject: input.subject,
        bodyText: input.bodyText,
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.inReplyTo !== undefined ? { inReplyTo: input.inReplyTo } : {}),
      });

      return {
        emailId: idGenerator.newId(),
        ...(result.providerMessageId !== undefined
          ? { providerMessageId: result.providerMessageId }
          : {}),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new EmailSendError(reason);
    }
  };
}
