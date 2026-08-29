import { type Db, MongoClient } from "mongodb";

const DEFAULT_URI = "mongodb://localhost:27017/sispaniers";

export interface MongoConnection {
  db: Db;
  close: () => Promise<void>;
}

export async function connectMongo(
  uri: string = process.env.MONGODB_URI ?? DEFAULT_URI,
): Promise<MongoConnection> {
  const client = new MongoClient(uri);

  await client.connect();

  return { db: client.db(), close: () => client.close() };
}
