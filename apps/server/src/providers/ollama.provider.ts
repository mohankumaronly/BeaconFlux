// Single responsibility: Ollama provider adapter wrapping native Ollama chat client.

import type { Provider, ProviderStreamChunk, ToolCall } from './base.provider.js';
import {
  streamOllamaChat,
  listModelsFrom,
  ensureModelAvailable,
  type OllamaChatMessage,
} from '../modules/ollama/ollama.client.js';

export class OllamaProvider implements Provider {
  readonly id: string;
  readonly type = 'ollama' as const;
  private readonly baseUrl: string;

  constructor(baseUrl: string, id = 'env-ollama') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.id = id;
  }

  async *chatStream(args: {
    model: string;
    messages: OllamaChatMessage[];
    tools?: any[];
    signal?: AbortSignal;
  }): AsyncGenerator<ProviderStreamChunk> {
    for await (const chunk of streamOllamaChat(
      this.baseUrl,
      args.messages,
      args.model,
      args.signal,
      args.tools,
    )) {
      if (chunk.type === 'tool_calls') {
        const normalizedToolCalls: ToolCall[] = chunk.toolCalls.map((tc: any) => {
          let parsedArgs = tc.function?.arguments;
          if (typeof parsedArgs === 'string') {
            try {
              parsedArgs = JSON.parse(parsedArgs);
            } catch {
              parsedArgs = {};
            }
          }
          if (typeof parsedArgs !== 'object' || parsedArgs === null || Array.isArray(parsedArgs)) {
            parsedArgs = {};
          }
          return {
            id: tc.id || undefined,
            function: {
              name: tc.function?.name || '',
              arguments: parsedArgs,
            },
          };
        });
        yield { type: 'tool_calls', toolCalls: normalizedToolCalls };
      } else {
        yield chunk;
      }
    }
  }

  async listModels(): Promise<string[]> {
    return listModelsFrom(this.baseUrl);
  }

  async ensureModel(model: string): Promise<void> {
    return ensureModelAvailable(this.baseUrl, model);
  }
}

export function makeOllamaProvider(baseUrl: string, id = 'env-ollama'): Provider {
  return new OllamaProvider(baseUrl, id);
}
