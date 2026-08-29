import nodemailer, { type Transporter } from "nodemailer";
import type {
  EmailSender,
  OutboundEmailMessage,
} from "../../../../domain/ports/email-sender.port.js";

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(gmailUser: string, gmailAppPassword: string) {
    this.fromAddress = gmailUser;
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailAppPassword },
    });
  }

  async send(message: OutboundEmailMessage): Promise<{ providerMessageId?: string }> {
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.bodyText,
      ...(message.bodyHtml !== undefined ? { html: message.bodyHtml } : {}),
      ...(message.inReplyTo !== undefined
        ? { inReplyTo: message.inReplyTo, references: message.inReplyTo }
        : {}),
    });

    return { providerMessageId: info.messageId };
  }
}
