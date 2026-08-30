import type { EmailSource } from "../model/email.js";
import type { Document } from "./document.js";

export interface ContextEmail {
  source: EmailSource;
  messageId: string;
  from: string;
  to?: string;
  subject: string;
  receivedAt: Date;
  bodyText?: string;
}

export interface OperationContext {
  emails: ContextEmail[];
  documents: Document[];
}
