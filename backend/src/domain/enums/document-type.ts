export const DOCUMENT_TYPES = [
  "PO",
  "BookingConfirmation",
  "BillOfLading",
  "Invoice",
  "PackingList",
  "ArrivalNotice",
  // For anything uploaded through the dashboard, where nobody classified it.
  // A manual attachment is not necessarily a purchase order — an unrelated
  // upload defaulting to "PO" is a false claim about what the document is,
  // not a harmless placeholder.
  "Other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
