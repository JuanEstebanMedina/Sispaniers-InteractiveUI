export interface OutboundEmailMessage {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  inReplyTo?: string;
}

export interface EmailSender {
  send(message: OutboundEmailMessage): Promise<{ providerMessageId?: string }>;
}
