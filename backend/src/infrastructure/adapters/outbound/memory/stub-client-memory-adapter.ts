import type { ClientMemoryPort } from "../../../../domain/ports/client-memory.port.js";

// ponytail: stub, the write-side tool that populates client memory is a
// future change — this only wires the read seam.
export class StubClientMemoryAdapter implements ClientMemoryPort {
  async query(_operationId: string): Promise<string[]> {
    return [];
  }
}
