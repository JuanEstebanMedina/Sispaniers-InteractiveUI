import { type Db, MongoClient } from "mongodb";

const DEFAULT_DATABASE = "sispaniers";
const DEFAULT_PORT = "27017";

function uriFromComposeCredentials(): string | undefined {
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;

  if (user === undefined || password === undefined) {
    return undefined;
  }

  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const host = `localhost:${process.env.MONGO_PORT ?? DEFAULT_PORT}`;
  const database = process.env.MONGO_DB ?? DEFAULT_DATABASE;

  return `mongodb://${credentials}@${host}/${database}?authSource=admin`;
}

export function resolveMongoUri(): string {
  return (
    process.env.MONGODB_URI ??
    uriFromComposeCredentials() ??
    `mongodb://localhost:${DEFAULT_PORT}/${DEFAULT_DATABASE}`
  );
}

export interface MongoConnection {
  db: Db;
  close: () => Promise<void>;
}

export async function connectMongo(uri: string = resolveMongoUri()): Promise<MongoConnection> {
  const client = new MongoClient(uri);

  await client.connect();

  return { db: client.db(), close: () => client.close() };
}
