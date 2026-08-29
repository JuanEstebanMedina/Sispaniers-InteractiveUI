import type { Client } from "../model/client.js";

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  save(client: Client): Promise<void>;
}
