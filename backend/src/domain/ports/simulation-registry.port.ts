import type { SimulationScript, TrackingEventTemplate } from "../logistics/simulation-script.js";

export interface DueSimulationStep {
  operationId: string;
  template: TrackingEventTemplate;
}

export interface SimulationRegistry {
  register(operationId: string, script: SimulationScript): void;
  dueSteps(): DueSimulationStep[];
  advance(operationId: string): void;
  isFinished(operationId: string): boolean;
}
