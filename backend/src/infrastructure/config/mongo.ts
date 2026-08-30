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

const CONNECT_MAX_ATTEMPTS = 5;
const CONNECT_RETRY_DELAY_MS = 2000;

async function connectWithRetry(client: MongoClient): Promise<void> {
  for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
    try {
      await client.connect();
      return;
    } catch (error) {
      if (attempt === CONNECT_MAX_ATTEMPTS) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
    }
  }
}

export async function connectMongo(uri: string = resolveMongoUri()): Promise<MongoConnection> {
  const client = new MongoClient(uri);

  await connectWithRetry(client);

  return { db: client.db(), close: () => client.close() };
}
