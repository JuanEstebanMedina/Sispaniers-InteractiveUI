export const CONTAINER_STATES = [
  "booking_confirmed",
  "in_transit",
  "arrived_port",
  "customs",
  "delivered",
] as const;

export type ContainerState = (typeof CONTAINER_STATES)[number];

export type DocumentType =
  | "PO"
  | "BookingConfirmation"
  | "BillOfLading"
  | "Invoice"
  | "PackingList"
  | "ArrivalNotice";

export interface Container {
  id: string;
  containerNumber: string;
  state: ContainerState;
}

export interface ScheduleChange {
  previousEta: Date;
  newEta: Date;
  reason: string;
  occurredAt: Date;
}

export interface Schedule {
  etdOriginal: Date;
  etaOriginal: Date;
  etaCurrent: Date;
  changes: ScheduleChange[];
}

export interface VesselPosition {
  lat: number;
  lng: number;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  carrier: string;
  vessel: string;
  originPort: string;
  destinationPort: string;
  schedule: Schedule;
  vesselPosition?: VesselPosition;
  containers: Container[];
}

export interface LogisticsDocument {
  id: string;
  type: DocumentType;
  bookingId?: string;
  sourceEmailId?: string;
  extractedData: Record<string, unknown>;
  receivedAt: Date;
}

export interface Operation {
  id: string;
  clientId: string;
  bookings: Booking[];
  documents: LogisticsDocument[];
  createdAt: Date;
}
