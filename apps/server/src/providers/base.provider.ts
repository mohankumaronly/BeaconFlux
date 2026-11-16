// Single responsibility: Define common Provider interface and stream chunk types.

import type { OllamaChatMessage } from '../modules/ollama/ollama.client.js';

export type ProviderStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'done' };

export type ToolCall = {
  id?: string; // OpenAI: "call_abc"; Ollama: undefined
  function: {
    name: string;
    arguments: Record<string, unknown>; // ALWAYS an object, never a string
  };
};

export interface Provider {
  readonly id: string; // uuid or "env-ollama" for env default
  readonly type: 'ollama' | 'openai' | 'custom';

  chatStream(args: {
    model: string;
    messages: OllamaChatMessage[];
    tools?: any[]; // OpenAI function-calling schema (already used)
    signal?: AbortSignal;
  }): AsyncGenerator<ProviderStreamChunk>;

  listModels(): Promise<string[]>;

  ensureModel(model: string): Promise<void>; // throws with actionable message if not found
}
