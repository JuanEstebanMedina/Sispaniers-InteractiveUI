export class EmailSendError extends Error {
  constructor(reason: string) {
    super(`Failed to send email: ${reason}`);
    this.name = "EmailSendError";
  }
}

export class OperationNotFoundError extends Error {
  constructor(id: string) {
    super(`Operation not found: ${id}`);
    this.name = "OperationNotFoundError";
  }
}

export class InvalidFilterCombinationError extends Error {
  constructor(reason: string) {
    super(`Invalid filter combination: ${reason}`);
    this.name = "InvalidFilterCombinationError";
  }
}

export class CompanyNotFoundError extends Error {
  constructor(id: string) {
    super(`Company not found: ${id}`);
    this.name = "CompanyNotFoundError";
  }
}

export class InvalidLayoutError extends Error {
  constructor(reason: string) {
    super(`Invalid layout: ${reason}`);
    this.name = "InvalidLayoutError";
  }
}

export class ComponentNotFoundError extends Error {
  constructor(id: string) {
    super(`Component not found: ${id}`);
    this.name = "ComponentNotFoundError";
  }
}

export class InvalidAiComponentError extends Error {
  constructor(reason: string) {
    super(`Invalid AI component output: ${reason}`);
    this.name = "InvalidAiComponentError";
  }
}

export class AiCompletionError extends Error {
  constructor(reason: string) {
    super(`AI completion failed: ${reason}`);
    this.name = "AiCompletionError";
  }
}

export class DocumentNotFoundError extends Error {
  constructor(id: string) {
    super(`Document not found: ${id}`);
    this.name = "DocumentNotFoundError";
  }
}

export class DocumentUploadError extends Error {
  constructor(reason: string) {
    super(`Failed to upload document: ${reason}`);
    this.name = "DocumentUploadError";
  }
}

export class InvalidComponentTreeError extends Error {
  constructor(reason: string) {
    super(`Invalid component tree: ${reason}`);
    this.name = "InvalidComponentTreeError";
  }
}

export class InvalidComponentPathError extends Error {
  constructor(reason: string) {
    super(`Invalid component path: ${reason}`);
    this.name = "InvalidComponentPathError";
  }
}

export class UnknownCommandError extends Error {
  constructor(name: string) {
    super(`Unknown command: ${name}`);
    this.name = "UnknownCommandError";
  }
}

export class InvalidCommandInputError extends Error {
  constructor(reason: string) {
    super(`Invalid command input: ${reason}`);
    this.name = "InvalidCommandInputError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(id: string) {
    super(`Booking not found: ${id}`);
    this.name = "BookingNotFoundError";
  }
}

export class ContainerNotFoundError extends Error {
  constructor(id: string) {
    super(`Container not found: ${id}`);
    this.name = "ContainerNotFoundError";
  }
}

export class CompanyReferenceRequiredError extends Error {
  constructor() {
    super("Either company_id or company must be provided");
    this.name = "CompanyReferenceRequiredError";
  }
}

export class CompanyNameConflictError extends Error {
  constructor(name: string) {
    super(`A company named "${name}" already exists`);
    this.name = "CompanyNameConflictError";
  }
}

export class CompanyDisabledError extends Error {
  constructor(email: string) {
    super(`Cannot send email to ${email}: its company is disabled`);
    this.name = "CompanyDisabledError";
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = "UserNotFoundError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class EmailConflictError extends Error {
  constructor(email: string) {
    super(`A user with email ${email} already exists`);
    this.name = "EmailConflictError";
  }
}

export class ForbiddenCompanyScopeError extends Error {
  constructor() {
    super("Actor cannot act outside their own company");
    this.name = "ForbiddenCompanyScopeError";
  }
}

export class InvalidCompanyConceptError extends Error {
  constructor(reason: string) {
    super(`Invalid company concept: ${reason}`);
    this.name = "InvalidCompanyConceptError";
  }
}
