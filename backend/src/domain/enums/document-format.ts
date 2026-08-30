export const DOCUMENT_FORMATS = ["pdf", "spreadsheet", "document", "image", "other"] as const;

export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];
