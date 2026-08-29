import type { Collection, Db } from "mongodb";
import type { ContainerState, Operation } from "../../../../domain/model/operation.js";
import type { OperationRepository } from "../../../../domain/ports/operation.repository.js";
import { type OperationDocument, toOperation, toOperationDocument } from "./operation.mapper.js";

const COLLECTION_NAME = "operations";

const DELIVERED: ContainerState = "delivered";

export class MongoOperationRepository implements OperationRepository {
  private readonly operations: Collection<OperationDocument>;

  constructor(db: Db) {
    this.operations = db.collection<OperationDocument>(COLLECTION_NAME);
  }

  async findById(id: string): Promise<Operation | null> {
    const document = await this.operations.findOne({ _id: id });

    return document === null ? null : toOperation(document);
  }

  async findActiveByClient(clientId: string): Promise<Operation[]> {
    const documents = await this.operations
      .find({
        clientId,
        $or: [
          {
            bookings: { $elemMatch: { containers: { $elemMatch: { state: { $ne: DELIVERED } } } } },
          },
          { "bookings.containers.state": { $exists: false } },
        ],
      })
      .toArray();

    return documents.map(toOperation);
  }

  async save(operation: Operation): Promise<void> {
    const document = toOperationDocument(operation);

    await this.operations.replaceOne({ _id: document._id }, document, { upsert: true });
  }
}
