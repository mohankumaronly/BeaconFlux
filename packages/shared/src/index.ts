export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatSummary = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: number;
  chatId: number;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type MessagesResponse = {
  chat: ChatSummary;
  messages: ChatMessage[];
};

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string | null;
  thumbnail?: string;
};

export type ServerStreamEvent =
  | { type: 'chat_created'; chatId: number }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: WebSource[] }
  | { type: 'done'; chatId: number; assistantMessageId: number }
  | { type: 'error'; message: string };

export type ChatRequestBody = {
  chatId?: number;
  message: string;
  model: string;
  ollamaUrl?: string;
  providerId?: string;
};

export type ChatRequest = ChatRequestBody;

export interface ProviderPreset {
  label: string;
  baseUrl: string;
  type: 'ollama' | 'openai' | 'custom';
}

export interface ProviderPublic {
  id: string;
  type: 'ollama' | 'openai' | 'custom';
  label: string;
  baseUrl: string;
  hasKey: boolean;
  defaultModel?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OllamaTestResponse =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export type HealthResponse = {
  ok: boolean;
  db: 'up' | 'down';
  error?: string;
};
