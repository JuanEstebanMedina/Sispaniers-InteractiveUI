import type { Operation } from "../../../domain/logistics/operation.js";
import type { TrackingEvent } from "../../../domain/logistics/tracking-event.js";
import type { OperationEventPublisher } from "../../../domain/ports/operation-event-publisher.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { SimulationRegistry } from "../../../domain/ports/simulation-registry.port.js";
import type { ApplyTrackingEventInput } from "./apply-tracking-event.use-case.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface RunSimulationTickDeps {
  operationRepository: OperationRepository;
  simulationRegistry: SimulationRegistry;
  operationEventPublisher: OperationEventPublisher;
  applyTrackingEvent: (input: ApplyTrackingEventInput) => Promise<Operation>;
}

export function createRunSimulationTickUseCase(deps: RunSimulationTickDeps) {
  const { operationRepository, simulationRegistry, operationEventPublisher, applyTrackingEvent } =
    deps;

  return async function runSimulationTick(): Promise<void> {
    const due = simulationRegistry.dueSteps();

    for (const { operationId, template } of due) {
      const operation = await operationRepository.findById(operationId);
      const booking = operation?.bookings[0];
      if (operation === null || booking === undefined) {
        simulationRegistry.advance(operationId);
        continue;
      }

      let event: TrackingEvent;
      if (template.type === "vessel_position") {
        event = {
          type: "vessel_position",
          bookingId: booking.id,
          lat: template.lat,
          lng: template.lng,
        };
      } else if (template.type === "schedule_change") {
        event = {
          type: "schedule_change",
          bookingId: booking.id,
          newEta: new Date(
            booking.schedule.etaCurrent.getTime() + template.etaOffsetDays * ONE_DAY_MS,
          ),
          reason: template.reason,
        };
      } else {
        const container = booking.containers[0];
        if (container === undefined) {
          simulationRegistry.advance(operationId);
          continue;
        }
        event = {
          type: "container_state",
          bookingId: booking.id,
          containerId: container.id,
          state: template.state,
        };
      }

      const updated = await applyTrackingEvent({ operationId, event });
      simulationRegistry.advance(operationId);

      if (simulationRegistry.isFinished(operationId)) {
        operationEventPublisher.publish(operationId, "simulation-completed", updated);
      }
    }
  };
}
