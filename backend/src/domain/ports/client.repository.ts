import type { Client } from "../logistics/client.js";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  save(client: Client): Promise<void>;
}
