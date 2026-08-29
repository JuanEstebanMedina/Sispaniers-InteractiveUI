export class EmailSendError extends Error {
  constructor(reason: string) {
    super(`Failed to send email: ${reason}`);
    this.name = "EmailSendError";
  }
}
