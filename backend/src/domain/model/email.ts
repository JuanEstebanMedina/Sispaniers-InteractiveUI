export type EmailSource = "make" | "gmail" | "outlook" | "manual";

export interface EmailAttachment {
  filename?: string;
  mimetype?: string;
  data?: string;
}

export interface NormalizedEmail {
  source: EmailSource;
  messageId: string;
  from: string;
  to?: string;
  subject: string;
  receivedAt: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
}
