import type { ContainerState } from "../enums/container-state.js";

// A template step omits bookingId/containerId — the simulator resolves those
// against the operation's single synthesized booking/container at apply time
// (see enroll-operation-in-simulation.use-case.ts).
export type TrackingEventTemplate =
  | { type: "vessel_position"; lat: number; lng: number }
  | { type: "schedule_change"; etaOffsetDays: number; reason: string }
  | { type: "container_state"; state: ContainerState };

export interface SimulationScript {
  id: string;
  steps: TrackingEventTemplate[];
}

// A handful of canned narratives for the Vietnam -> Mexico route (Muebles del
// Sur / MSC LUCINDA case), each telling a different story so operations
// simulated in parallel don't all look the same.

const SCRIPT_SMOOTH: SimulationScript = {
  id: "smooth",
  steps: [
    { type: "container_state", state: "in_transit" },
    { type: "vessel_position", lat: 10.55, lng: 107.02 },
    { type: "vessel_position", lat: 15, lng: -150 },
    { type: "container_state", state: "arrived_port" },
    { type: "container_state", state: "customs" },
    { type: "container_state", state: "delivered" },
  ],
};

const SCRIPT_TRANSSHIPMENT_DELAY: SimulationScript = {
  id: "transshipment_delay",
  steps: [
    { type: "container_state", state: "in_transit" },
    { type: "vessel_position", lat: 1.29, lng: 103.85 },
    {
      type: "schedule_change",
      etaOffsetDays: 9,
      reason: "unplanned transshipment at Singapore — vessel swap required",
    },
    { type: "vessel_position", lat: 15, lng: -150 },
    { type: "container_state", state: "arrived_port" },
    { type: "container_state", state: "delivered" },
  ],
};

const SCRIPT_CUSTOMS_HOLD: SimulationScript = {
  id: "customs_hold",
  steps: [
    { type: "container_state", state: "in_transit" },
    { type: "vessel_position", lat: 12, lng: -170 },
    { type: "container_state", state: "arrived_port" },
    { type: "container_state", state: "customs" },
    // no further steps — the operation stalls here, unresolved on purpose
  ],
};

const SCRIPT_AHEAD_OF_SCHEDULE: SimulationScript = {
  id: "ahead_of_schedule",
  steps: [
    { type: "container_state", state: "in_transit" },
    { type: "vessel_position", lat: 14, lng: -140 },
    {
      type: "schedule_change",
      etaOffsetDays: -3,
      reason: "favorable winds, running ahead of schedule",
    },
    { type: "container_state", state: "arrived_port" },
    { type: "container_state", state: "customs" },
    { type: "container_state", state: "delivered" },
  ],
};

const SCRIPT_COMPOUND_PROBLEM: SimulationScript = {
  id: "compound_problem",
  steps: [
    { type: "container_state", state: "in_transit" },
    { type: "vessel_position", lat: 10.55, lng: 107.02 },
    { type: "schedule_change", etaOffsetDays: 5, reason: "port congestion at origin" },
    { type: "vessel_position", lat: 8, lng: -160 },
    {
      type: "schedule_change",
      etaOffsetDays: 6,
      reason: "customs inspection backlog at destination port",
    },
    { type: "container_state", state: "arrived_port" },
    { type: "container_state", state: "customs" },
    // no delivered — this is the operation that needs the most attention
  ],
};

export const SIMULATION_SCRIPTS: SimulationScript[] = [
  SCRIPT_SMOOTH,
  SCRIPT_TRANSSHIPMENT_DELAY,
  SCRIPT_CUSTOMS_HOLD,
  SCRIPT_AHEAD_OF_SCHEDULE,
  SCRIPT_COMPOUND_PROBLEM,
];

export function pickRandomScript(): SimulationScript {
  const index = Math.floor(Math.random() * SIMULATION_SCRIPTS.length);
  return SIMULATION_SCRIPTS[index] ?? SCRIPT_SMOOTH;
}
