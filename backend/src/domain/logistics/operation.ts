import type { ContainerState } from "../enums/container-state.js";
import type { OperationHealth } from "../enums/operation-health.js";
import type { OperationContext } from "./operation-context.js";

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
  companyIds: string[];
  carrier: string;
  vessel: string;
  originPort: string;
  destinationPort: string;
  schedule: Schedule;
  vesselPosition?: VesselPosition;
  containers: Container[];
}

export interface Operation {
  id: string;
  /**
   * The company the operation was opened for. Absent when the operation was
   * created from an inbound email, where no company is known yet. Distinct from
   * `Booking.companyIds`, which are the parties on a given booking.
   */
  companyId?: string;
  bookings: Booking[];
  context: OperationContext;
  createdAt: Date;
  health?: OperationHealth;
}
