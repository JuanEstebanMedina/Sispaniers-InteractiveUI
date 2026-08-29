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

export class InvalidLayoutError extends Error {
  constructor(reason: string) {
    super(`Invalid layout: ${reason}`);
    this.name = "InvalidLayoutError";
  }
}
