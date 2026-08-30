import type { Booking, Operation } from "../../../domain/logistics/operation.js";
import { pickRandomScript } from "../../../domain/logistics/simulation-script.js";
import type { IdGenerator } from "../../../domain/ports/id-generator.port.js";
import type { OperationEventPublisher } from "../../../domain/ports/operation-event-publisher.port.js";
import type { OperationRepository } from "../../../domain/ports/operation.repository.js";
import type { SimulationRegistry } from "../../../domain/ports/simulation-registry.port.js";

const VESSEL_NAMES = ["MSC LUCINDA", "MSC TOMOKO", "MSC ANNA", "MSC GAIA"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface EnrollOperationInSimulationInput {
  operationId: string;
  companyId?: string;
}

export interface EnrollOperationInSimulationDeps {
  operationRepository: OperationRepository;
  operationEventPublisher: OperationEventPublisher;
  simulationRegistry: SimulationRegistry;
  idGenerator: IdGenerator;
}

function randomOf<T>(items: T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error("randomOf called with an empty array");
  }
  return item;
}

function synthesizeBooking(idGenerator: IdGenerator, companyId: string | undefined): Booking {
  const now = new Date();
  const etaOriginal = new Date(now.getTime() + 25 * ONE_DAY_MS);
  const containerNumber = `MEDU${Math.floor(1_000_000 + Math.random() * 9_000_000)}`;

  return {
    id: idGenerator.newId(),
    companyIds: companyId !== undefined ? [companyId] : [],
    carrier: "MSC Mediterranean Shipping Company",
    vessel: randomOf(VESSEL_NAMES),
    originPort: "Cai Mep, Vietnam",
    destinationPort: "Manzanillo, Mexico",
    schedule: { etdOriginal: now, etaOriginal, etaCurrent: etaOriginal, changes: [] },
    containers: [{ id: idGenerator.newId(), containerNumber, state: "booking_confirmed" }],
  };
}

// TODO: wire up the real agent here — today every newly created operation
// gets a random canned script from SIMULATION_SCRIPTS to stand in for a real
// carrier tracking feed. See run-simulation-tick.use-case.ts for the ticker
// that advances these.
export function createEnrollOperationInSimulationUseCase(deps: EnrollOperationInSimulationDeps) {
  const { operationRepository, operationEventPublisher, simulationRegistry, idGenerator } = deps;

  return async function enrollOperationInSimulation(
    input: EnrollOperationInSimulationInput,
  ): Promise<void> {
    const operation = await operationRepository.findById(input.operationId);
    if (operation === null) {
      return;
    }

    const booking = synthesizeBooking(idGenerator, input.companyId);
    const updated: Operation = { ...operation, bookings: [...operation.bookings, booking] };

    await operationRepository.save(updated);
    operationEventPublisher.publish(updated.id, "operation-updated", updated);
    simulationRegistry.register(updated.id, pickRandomScript());
  };
}
