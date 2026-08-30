import type { DocumentFormat } from "../enums/document-format.js";
import type { DocumentType } from "../enums/document-type.js";

export interface Document {
  id: string;
  type: DocumentType;
  /**
   * El nombre con el que llegó el archivo.
   *
   * Opcional porque los documentos guardados antes de este campo no lo tienen;
   * para esos, el último segmento de `bucketKey` sigue siendo la mejor pista.
   */
  filename?: string;
  format: DocumentFormat;
  bucketKey: string;
  bookingId?: string;
  sourceEmailId?: string;
  extractedData: Record<string, unknown>;
  receivedAt: Date;
}
