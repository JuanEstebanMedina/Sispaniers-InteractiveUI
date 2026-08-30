import type { Collection, Db } from "mongodb";
import type { User } from "../../../../domain/logistics/user.js";
import type { UserRepository } from "../../../../domain/ports/user.repository.js";
import { type UserDocument, toUser, toUserDocument } from "./user.mapper.js";

const COLLECTION_NAME = "users";

export class MongoUserRepository implements UserRepository {
  private readonly users: Collection<UserDocument>;

  constructor(db: Db) {
    this.users = db.collection<UserDocument>(COLLECTION_NAME);
  }

  async findById(id: string): Promise<User | null> {
    const document = await this.users.findOne({ _id: id });

    return document === null ? null : toUser(document);
  }

  async findByEmail(email: string): Promise<User | null> {
    const escaped = email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const document = await this.users.findOne({
      email: { $regex: `^${escaped}$`, $options: "i" },
    });

    return document === null ? null : toUser(document);
  }

  async findAllByCompany(companyId?: string): Promise<User[]> {
    const documents = await this.users.find(companyId === undefined ? {} : { companyId }).toArray();

    return documents.map(toUser);
  }

  async save(user: User): Promise<void> {
    const document = toUserDocument(user);

    await this.users.replaceOne({ _id: document._id }, document, { upsert: true });
  }
}
