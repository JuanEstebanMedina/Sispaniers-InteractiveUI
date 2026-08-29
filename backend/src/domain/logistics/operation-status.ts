import { CONTAINER_STATES, type ContainerState } from "../enums/container-state.js";
import type { Booking, Operation } from "./operation.js";

const EARLIEST_STATE: ContainerState = CONTAINER_STATES[0];

function progressOf(state: ContainerState): number {
  return CONTAINER_STATES.indexOf(state);
}

function leastAdvanced(states: ContainerState[]): ContainerState {
  const [first, ...rest] = states;

  if (first === undefined) {
    return EARLIEST_STATE;
  }

  return rest.reduce(
    (laggard, state) => (progressOf(state) < progressOf(laggard) ? state : laggard),
    first,
  );
}

export function deriveBookingStatus(booking: Booking): ContainerState {
  return leastAdvanced(booking.containers.map((container) => container.state));
}

export function deriveOperationStatus(operation: Operation): ContainerState {
  const loadedBookings = operation.bookings.filter((booking) => booking.containers.length > 0);

  return leastAdvanced(loadedBookings.map(deriveBookingStatus));
}
