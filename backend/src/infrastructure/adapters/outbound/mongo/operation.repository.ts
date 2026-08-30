import type { Collection, Db, Filter } from "mongodb";
import type { Operation } from "../../../../domain/logistics/operation.js";
import type {
  OperationQueryFilter,
  OperationRepository,
} from "../../../../domain/ports/operation.repository.js";
import { type OperationDocument, toOperation, toOperationDocument } from "./operation.mapper.js";

const COLLECTION_NAME = "operations";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class MongoOperationRepository implements OperationRepository {
  private readonly operations: Collection<OperationDocument>;

  constructor(db: Db) {
    this.operations = db.collection<OperationDocument>(COLLECTION_NAME);
  }

  async findById(id: string): Promise<Operation | null> {
    const document = await this.operations.findOne({ _id: id });

    return document === null ? null : toOperation(document);
  }

  async findAll(filter: OperationQueryFilter = {}): Promise<Operation[]> {
    const query: Filter<OperationDocument> = {};

    if (filter.ids !== undefined) {
      query._id = { $in: filter.ids };
    }
    if (filter.health !== undefined) {
      query.health = filter.health;
    }
    if (filter.search !== undefined) {
      // Mismo criterio que el repositorio en memoria: id, empresas y puertos.
      // `escapeRegex` existe porque un buscador es entrada del usuario y un
      // paréntesis suelto rompería la consulta.
      const needle = new RegExp(escapeRegex(filter.search), "i");
      query.$or = [
        { _id: { $regex: needle } },
        { "bookings.companyIds": { $regex: needle } },
        { "bookings.originPort": { $regex: needle } },
        { "bookings.destinationPort": { $regex: needle } },
      ];
    }
    if (filter.createdFrom !== undefined || filter.createdTo !== undefined) {
      query.createdAt = {
        ...(filter.createdFrom !== undefined ? { $gte: filter.createdFrom } : {}),
        ...(filter.createdTo !== undefined ? { $lte: filter.createdTo } : {}),
      };
    }

    const documents = await this.operations.find(query).toArray();

    return documents.map(toOperation);
  }

  async save(operation: Operation): Promise<void> {
    const document = toOperationDocument(operation);

    await this.operations.replaceOne({ _id: document._id }, document, { upsert: true });
  }
}
