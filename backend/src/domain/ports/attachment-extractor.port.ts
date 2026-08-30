import type { IncomingAttachment } from "../model/email.js";
import type { ExtractedContent } from "../model/extracted-content.js";

export interface AttachmentExtractor {
  extract(attachment: IncomingAttachment): Promise<ExtractedContent>;
}
