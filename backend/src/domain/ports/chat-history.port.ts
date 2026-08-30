import type { ChatMessage } from "../model/chat-message.js";

export interface ChatHistoryPort {
  append(operationId: string, message: ChatMessage): void;
  get(operationId: string): ChatMessage[];
}
