export const DOCUMENT_TYPES = [
  "PO",
  "BookingConfirmation",
  "BillOfLading",
  "Invoice",
  "PackingList",
  "ArrivalNotice",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
