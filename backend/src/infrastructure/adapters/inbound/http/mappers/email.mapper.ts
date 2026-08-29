import type { EmailAttachment, NormalizedEmail } from "../../../../../domain/model/email.js";
import type { ReceiveEmailBody } from "../schemas/receive-email.schema.js";

export function toNormalizedEmail(dto: ReceiveEmailBody): NormalizedEmail {
  const attachments: EmailAttachment[] | undefined = dto.attachments?.map((attachment) => ({
    ...(attachment.filename !== undefined ? { filename: attachment.filename } : {}),
    ...(attachment.mimetype !== undefined ? { mimetype: attachment.mimetype } : {}),
    ...(attachment.data !== undefined ? { data: attachment.data } : {}),
  }));

  return {
    source: dto.source,
    messageId: dto.message_id,
    from: dto.from,
    ...(dto.to !== undefined ? { to: dto.to } : {}),
    subject: dto.subject,
    receivedAt: dto.received_at,
    ...(dto.body_text !== undefined ? { bodyText: dto.body_text } : {}),
    ...(dto.body_html !== undefined ? { bodyHtml: dto.body_html } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
  };
}
