import type { ChatMessage } from "../../../../domain/model/chat-message.js";
import type { ChatHistoryPort } from "../../../../domain/ports/chat-history.port.js";

export const MAX_CHAT_HISTORY_MESSAGES = 20;

// In-memory only, per process — matches InMemorySimulationRegistry's scope.
// A restart resets every operation's chat history to empty.
export class InMemoryChatHistoryStore implements ChatHistoryPort {
  private readonly conversations = new Map<string, ChatMessage[]>();

  append(operationId: string, message: ChatMessage): void {
    const existing = this.conversations.get(operationId) ?? [];
    const updated = [...existing, message].slice(-MAX_CHAT_HISTORY_MESSAGES);
    this.conversations.set(operationId, updated);
  }

  get(operationId: string): ChatMessage[] {
    return this.conversations.get(operationId) ?? [];
  }
}
