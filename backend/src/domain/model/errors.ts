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
