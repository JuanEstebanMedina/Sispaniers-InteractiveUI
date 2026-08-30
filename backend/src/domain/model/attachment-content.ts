export type AttachmentContentKind = "text" | "image" | "unsupported";

export interface ExtractedAttachment {
  filename?: string;
  mimetype?: string;
  kind: AttachmentContentKind;
  content?: string;
  error?: string;
  storagePath?: string;
  storageError?: string;
}
