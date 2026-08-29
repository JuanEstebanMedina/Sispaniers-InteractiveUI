import { expect, test } from "vitest";
import {
  deriveBookingStatus,
  deriveOperationStatus,
} from "../../src/domain/logistics/operation-status.js";
import type {
  Booking,
  Container,
  ContainerState,
  Operation,
} from "../../src/domain/logistics/operation.js";

function containerIn(state: ContainerState): Container {
  return { id: `container-${state}`, containerNumber: `MSKU${state}`, state };
}

function bookingWith(states: ContainerState[]): Booking {
  return {
    id: `booking-${states.join("-")}`,
    carrier: "Maersk",
    vessel: "Ever Given",
    originPort: "CNSHA",
    destinationPort: "COCTG",
    schedule: {
      etdOriginal: new Date("2026-01-01T00:00:00.000Z"),
      etaOriginal: new Date("2026-02-01T00:00:00.000Z"),
      etaCurrent: new Date("2026-02-01T00:00:00.000Z"),
      changes: [],
    },
    containers: states.map(containerIn),
  };
}

function operationWith(bookings: Booking[]): Operation {
  return {
    id: "operation-1",
    clientId: "client-1",
    bookings,
    documents: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("a booking reports the state of its least advanced container", () => {
  const booking = bookingWith(["delivered", "in_transit", "customs"]);

  expect(deriveBookingStatus(booking)).toBe("in_transit");
});

test("a single container stuck in customs keeps the whole booking in customs", () => {
  const booking = bookingWith(["delivered", "delivered", "customs", "delivered"]);

  expect(deriveBookingStatus(booking)).toBe("customs");
});

test("a booking is delivered only once every container is delivered", () => {
  const booking = bookingWith(["delivered", "delivered"]);

  expect(deriveBookingStatus(booking)).toBe("delivered");
});

test("a booking with a single container reports that container's state", () => {
  const booking = bookingWith(["arrived_port"]);

  expect(deriveBookingStatus(booking)).toBe("arrived_port");
});

test("a booking without containers has not moved yet", () => {
  const booking = bookingWith([]);

  expect(deriveBookingStatus(booking)).toBe("booking_confirmed");
});

test("an operation reports the state of its least advanced booking", () => {
  const operation = operationWith([
    bookingWith(["delivered", "delivered"]),
    bookingWith(["customs", "delivered"]),
    bookingWith(["arrived_port", "delivered"]),
  ]);

  expect(deriveOperationStatus(operation)).toBe("arrived_port");
});

test("an operation is delivered only once every booking is delivered", () => {
  const operation = operationWith([
    bookingWith(["delivered"]),
    bookingWith(["delivered", "delivered"]),
  ]);

  expect(deriveOperationStatus(operation)).toBe("delivered");
});

test("a booking whose containers are not loaded yet does not hold the operation back", () => {
  const operation = operationWith([bookingWith(["delivered"]), bookingWith([])]);

  expect(deriveOperationStatus(operation)).toBe("delivered");
});

test("an operation whose bookings are all still empty has not moved yet", () => {
  const operation = operationWith([bookingWith([]), bookingWith([])]);

  expect(deriveOperationStatus(operation)).toBe("booking_confirmed");
});

test("an operation without bookings has not moved yet", () => {
  const operation = operationWith([]);

  expect(deriveOperationStatus(operation)).toBe("booking_confirmed");
});

test("neither derivation throws on an empty read path", () => {
  expect(() => deriveBookingStatus(bookingWith([]))).not.toThrow();
  expect(() => deriveOperationStatus(operationWith([]))).not.toThrow();
});
