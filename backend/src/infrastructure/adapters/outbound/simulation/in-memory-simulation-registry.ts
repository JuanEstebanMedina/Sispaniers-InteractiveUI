import type { SimulationScript } from "../../../../domain/logistics/simulation-script.js";
import type {
  DueSimulationStep,
  SimulationRegistry,
} from "../../../../domain/ports/simulation-registry.port.js";

interface RegistryEntry {
  script: SimulationScript;
  stepIndex: number;
}

// In-memory only, per process — matches InMemoryComponentEventPublisher's
// scope. A restart resets any operation's simulation back to its first step.
export class InMemorySimulationRegistry implements SimulationRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  register(operationId: string, script: SimulationScript): void {
    this.entries.set(operationId, { script, stepIndex: 0 });
  }

  dueSteps(): DueSimulationStep[] {
    const due: DueSimulationStep[] = [];

    for (const [operationId, entry] of this.entries) {
      const template = entry.script.steps[entry.stepIndex];
      if (template !== undefined) {
        due.push({ operationId, template });
      }
    }

    return due;
  }

  advance(operationId: string): void {
    const entry = this.entries.get(operationId);
    if (entry !== undefined) {
      entry.stepIndex += 1;
    }
  }

  isFinished(operationId: string): boolean {
    const entry = this.entries.get(operationId);
    return entry !== undefined && entry.stepIndex >= entry.script.steps.length;
  }
}
