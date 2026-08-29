import { randomUUID } from "node:crypto";
import type { IdGenerator } from "../../../../domain/ports/id-generator.port.js";

export class CryptoIdGenerator implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}
