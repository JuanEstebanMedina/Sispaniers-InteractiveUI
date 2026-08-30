import type { Booking, Operation } from "../../../domain/logistics/operation.js";
import type { TrackingEvent } from "../../../domain/logistics/tracking-event.js";
import {
  BookingNotFoundError,
  ContainerNotFoundError,
  OperationNotFoundError,
} from "../../../domain/model/errors.js";
import type { OperationEventPublisher } from "../../../domain/ports/operation-event-publisher.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";

export interface ApplyTrackingEventInput {
  operationId: string;
  event: TrackingEvent;
}

export interface ApplyTrackingEventDeps {
  operationRepository: OperationRepository;
  operationEventPublisher: OperationEventPublisher;
}

function applyToBooking(booking: Booking, event: TrackingEvent, now: Date): Booking {
  if (event.type === "vessel_position") {
    return { ...booking, vesselPosition: { lat: event.lat, lng: event.lng, updatedAt: now } };
  }

  if (event.type === "schedule_change") {
    return {
      ...booking,
      schedule: {
        ...booking.schedule,
        etaCurrent: event.newEta,
        changes: [
          ...booking.schedule.changes,
          {
            previousEta: booking.schedule.etaCurrent,
            newEta: event.newEta,
            reason: event.reason,
            occurredAt: now,
          },
        ],
      },
    };
  }

  const containerIndex = booking.containers.findIndex((c) => c.id === event.containerId);
  if (containerIndex === -1) {
    throw new ContainerNotFoundError(event.containerId);
  }

  return {
    ...booking,
    containers: booking.containers.map((container) =>
      container.id === event.containerId ? { ...container, state: event.state } : container,
    ),
  };
}

export function createApplyTrackingEventUseCase(deps: ApplyTrackingEventDeps) {
  const { operationRepository, operationEventPublisher } = deps;

  return async function applyTrackingEvent(input: ApplyTrackingEventInput): Promise<Operation> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      throw new OperationNotFoundError(input.operationId);
    }

    const { event } = input;
    const bookingIndex = operation.bookings.findIndex((booking) => booking.id === event.bookingId);
    if (bookingIndex === -1) {
      throw new BookingNotFoundError(event.bookingId);
    }
    const booking = operation.bookings[bookingIndex];
    if (booking === undefined) {
      throw new BookingNotFoundError(event.bookingId);
    }

    const now = new Date();
    const updatedBooking = applyToBooking(booking, event, now);

    const updated: Operation = {
      ...operation,
      bookings: operation.bookings.map((b, index) => (index === bookingIndex ? updatedBooking : b)),
    };

    await operationRepository.save(updated);
    operationEventPublisher.publish(updated.id, "operation-updated", updated);

    return updated;
  };
}
