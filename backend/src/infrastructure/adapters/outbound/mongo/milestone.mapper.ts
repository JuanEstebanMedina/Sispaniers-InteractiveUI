import type { Milestone } from "../../../../domain/model/milestone.js";

export type MilestoneDocument = Omit<Milestone, "id"> & { _id: string };

export function toMilestoneDocument({ id, ...rest }: Milestone): MilestoneDocument {
  return { _id: id, ...rest };
}

export function toMilestone({ _id, ...rest }: MilestoneDocument): Milestone {
  return { id: _id, ...rest };
}
