export interface ClientMemoryPort {
  query(operationId: string): Promise<string[]>;
}
