import type { DocumentFormat } from "../enums/document-format.js";
import type { DocumentType } from "../enums/document-type.js";

export interface Document {
  id: string;
  type: DocumentType;
  filename?: string;
  format: DocumentFormat;
  bucketKey: string;
  bookingId?: string;
  sourceEmailId?: string;
  extractedData: Record<string, unknown>;
  receivedAt: Date;
}
