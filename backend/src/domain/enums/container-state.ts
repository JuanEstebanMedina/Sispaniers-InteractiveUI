export const CONTAINER_STATES = [
  "booking_confirmed",
  "in_transit",
  "arrived_port",
  "customs",
  "delivered",
] as const;

export type ContainerState = (typeof CONTAINER_STATES)[number];
