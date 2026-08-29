import type { Collection, Db } from "mongodb";
import type { Component } from "../../../../domain/components/component.js";
import type { ComponentRepository } from "../../../../domain/ports/component.repository.js";
import { type ComponentDocument, toComponent, toComponentDocument } from "./component.mapper.js";

const COLLECTION_NAME = "components";

export class MongoComponentRepository implements ComponentRepository {
  private readonly components: Collection<ComponentDocument>;

  constructor(db: Db) {
    this.components = db.collection<ComponentDocument>(COLLECTION_NAME);
  }

  async findByOperationId(operationId: string): Promise<Component[]> {
    const documents = await this.components.find({ operationId }).toArray();

    return documents.map(toComponent);
  }

  async save(component: Component): Promise<void> {
    const document = toComponentDocument(component);

    await this.components.replaceOne({ _id: document._id }, document, { upsert: true });
  }
}
