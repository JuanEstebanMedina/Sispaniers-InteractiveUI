import type { ExtractedAttachment } from "../model/attachment-content.js";
import type { EmailAttachment } from "../model/email.js";

export interface AttachmentExtractor {
  extract(attachment: EmailAttachment): Promise<ExtractedAttachment>;
}
