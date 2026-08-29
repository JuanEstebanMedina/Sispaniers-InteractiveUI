export interface AiCompletionRequest {
  prompt: string;
}

export interface AiCompletionResponse {
  text: string;
}

export interface AiCompletionPort {
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}
