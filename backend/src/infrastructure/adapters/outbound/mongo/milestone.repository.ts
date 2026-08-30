import type { Collection, Db } from "mongodb";
import type { Milestone, MilestoneType } from "../../../../domain/model/milestone.js";
import type { EpisodicMemoryPort } from "../../../../domain/ports/episodic-memory.port.js";
import type { IdGenerator } from "../../../../domain/ports/id-generator.port.js";
import { type MilestoneDocument, toMilestone, toMilestoneDocument } from "./milestone.mapper.js";

const COLLECTION_NAME = "flow_milestones";

// Append-only: recordMilestone always inserts, never replaceOne/upsert.
// Episodic memory is a timeline of discrete events, not a current-state
// snapshot like the other Mongo repositories in this codebase.
export class MongoEpisodicMemoryRepository implements EpisodicMemoryPort {
  private readonly milestones: Collection<MilestoneDocument>;

  constructor(
    db: Db,
    private readonly idGenerator: IdGenerator,
  ) {
    this.milestones = db.collection<MilestoneDocument>(COLLECTION_NAME);
  }

  async recordMilestone(
    operationId: string,
    type: MilestoneType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const milestone: Milestone = {
      id: this.idGenerator.newId(),
      operationId,
      type,
      payload,
      recordedAt: new Date(),
    };
    await this.milestones.insertOne(toMilestoneDocument(milestone));
  }

  async findByOperationId(operationId: string): Promise<Milestone[]> {
    const documents = await this.milestones.find({ operationId }).sort({ recordedAt: 1 }).toArray();

    return documents.map(toMilestone);
  }
}
