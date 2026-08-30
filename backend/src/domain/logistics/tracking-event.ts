import type { ContainerState } from "../enums/container-state.js";

export type TrackingEvent =
  | { type: "vessel_position"; bookingId: string; lat: number; lng: number }
  | { type: "schedule_change"; bookingId: string; newEta: Date; reason: string }
  | { type: "container_state"; bookingId: string; containerId: string; state: ContainerState };
