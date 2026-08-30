import type { DocumentFormat } from "../enums/document-format.js";

export interface ExtractedContent {
  filename?: string;
  mimetype?: string;
  format: DocumentFormat;
  content?: string;
  error?: string;
  storagePath?: string;
  storageError?: string;
}
