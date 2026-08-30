import type { Milestone, MilestoneType } from "../model/milestone.js";

export interface EpisodicMemoryPort {
  recordMilestone(
    operationId: string,
    type: MilestoneType,
    payload: Record<string, unknown>,
  ): Promise<void>;
  findByOperationId(operationId: string): Promise<Milestone[]>;
}
