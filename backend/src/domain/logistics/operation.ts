import type { ContainerState } from "../enums/container-state.js";
import type { DocumentType } from "../enums/document-type.js";
import type { OperationHealth } from "../enums/operation-health.js";

export type { ContainerState } from "../enums/container-state.js";

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
  health?: OperationHealth;
}
