// Single responsibility: OpenAI-compatible provider adapter with SSE streaming and tool-call accumulation.

import type { Provider, ProviderStreamChunk, ToolCall } from './base.provider.js';
import type { OllamaChatMessage } from '../modules/ollama/ollama.client.js';
import { assertSafeBaseUrl } from './ssrf.js';
import { logger } from '../lib/logger.js';

type ModelCacheEntry = {
  expiresAt: number;
  models: string[];
};

const modelListCache = new Map<string, ModelCacheEntry>();

function translateUrlForDocker(rawUrl: string): string {
  let url = rawUrl;
  if (process.env.DOCKER_ENV === 'true') {
    if (url.includes('localhost')) url = url.replace('localhost', 'host.docker.internal');
    if (url.includes('127.0.0.1')) url = url.replace('127.0.0.1', 'host.docker.internal');
  }
  return url;
}

export type OpenAIProviderOptions = {
  id: string;
  baseUrl: string;
  apiKey?: string | null;
  type?: 'openai' | 'custom';
};

export class OpenAIProvider implements Provider {
  readonly id: string;
  readonly type: 'openai' | 'custom';
  private readonly rawBaseUrl: string;
  private readonly apiKey: string | null;

  constructor(opts: OpenAIProviderOptions) {
    this.id = opts.id;
    this.rawBaseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey ?? null;
    this.type = opts.type ?? 'openai';
  }

  private async getTargetBaseUrl(): Promise<string> {
    await assertSafeBaseUrl(this.rawBaseUrl, this.type);
    return translateUrlForDocker(this.rawBaseUrl);
  }

  private convertMessages(messages: OllamaChatMessage[]): any[] {
    return messages.map((m, index) => {
      if (m.role === 'tool') {
        if (!m.tool_call_id) {
          throw new Error('Missing tool_call_id on tool role message');
        }
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id,
          content: m.content,
        };
      }

      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        const toolCalls = m.tool_calls.map((tc: any, tcIdx: number) => ({
          id: tc.id || `call_${tcIdx}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'function',
          function: {
            name: tc.function?.name || '',
            arguments:
              typeof tc.function?.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments || {}),
          },
        }));
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: toolCalls,
        };
      }

      return {
        role: m.role,
        content: m.content,
      };
    });
  }

  async *chatStream(args: {
    model: string;
    messages: OllamaChatMessage[];
    tools?: any[];
    signal?: AbortSignal;
  }): AsyncGenerator<ProviderStreamChunk> {
    if (args.signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

    const targetBaseUrl = await this.getTargetBaseUrl();
    const endpoint = `${targetBaseUrl}/chat/completions`;

    const convertedMessages = this.convertMessages(args.messages);
    const bodyPayload: Record<string, unknown> = {
      model: args.model,
      messages: convertedMessages,
      stream: true,
    };

    if (args.tools && args.tools.length > 0) {
      bodyPayload['tools'] = args.tools;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: args.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const toolBufs = new Map<number, { id: string; name: string; args: string }>();
    let hasYieldedToolCalls = false;

    const buildToolCalls = (): ToolCall[] => {
      const sortedEntries = Array.from(toolBufs.entries()).sort(([a], [b]) => a - b);
      return sortedEntries.map(([_, buf]) => {
        let parsedArgs: Record<string, unknown> = {};
        if (buf.args && buf.args.trim().length > 0) {
          try {
            const parsed = JSON.parse(buf.args);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              parsedArgs = parsed as Record<string, unknown>;
            }
          } catch {
            logger.warn({ rawArgs: buf.args }, 'Failed to parse tool call arguments as JSON');
            parsedArgs = {};
          }
        }
        return {
          id: buf.id || undefined,
          function: {
            name: buf.name,
            arguments: parsedArgs,
          },
        };
      });
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);

          if (!line || line.startsWith(':')) continue; // keepalive or empty

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              if (toolBufs.size > 0 && !hasYieldedToolCalls) {
                hasYieldedToolCalls = true;
                yield { type: 'tool_calls', toolCalls: buildToolCalls() };
              }
              yield { type: 'done' };
              return;
            }

            let obj: any;
            try {
              obj = JSON.parse(dataStr);
            } catch {
              continue;
            }

            const choice = obj.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (delta) {
              if (typeof delta.content === 'string' && delta.content.length > 0) {
                yield { type: 'token', text: delta.content };
              }

              if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  const existing = toolBufs.get(idx);
                  if (!existing) {
                    toolBufs.set(idx, {
                      id: tc.id || '',
                      name: tc.function?.name || '',
                      args: tc.function?.arguments || '',
                    });
                  } else {
                    if (tc.id) existing.id += tc.id;
                    if (tc.function?.name) existing.name += tc.function.name;
                    if (tc.function?.arguments) existing.args += tc.function.arguments;
                  }
                }
              }
            }

            if (choice.finish_reason === 'tool_calls' && toolBufs.size > 0 && !hasYieldedToolCalls) {
              hasYieldedToolCalls = true;
              yield { type: 'tool_calls', toolCalls: buildToolCalls() };
            }
          }
        }
      }

      // Flush any trailing buffer data
      const remaining = buffer.trim();
      if (remaining.startsWith('data: ')) {
        const dataStr = remaining.slice(6).trim();
        if (dataStr === '[DONE]') {
          if (toolBufs.size > 0 && !hasYieldedToolCalls) {
            hasYieldedToolCalls = true;
            yield { type: 'tool_calls', toolCalls: buildToolCalls() };
          }
          yield { type: 'done' };
          return;
        }
      }

      if (toolBufs.size > 0 && !hasYieldedToolCalls) {
        hasYieldedToolCalls = true;
        yield { type: 'tool_calls', toolCalls: buildToolCalls() };
      }

      yield { type: 'done' };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw err;
      }
      throw err;
    }
  }

  async listModels(): Promise<string[]> {
    const cacheKey = `${this.id}:${this.rawBaseUrl}`;
    const cached = modelListCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.models;
    }

    const targetBaseUrl = await this.getTargetBaseUrl();
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${targetBaseUrl}/models`, { headers });
    if (!res.ok) {
      throw new Error(`OpenAI /models returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id);

    modelListCache.set(cacheKey, {
      expiresAt: now + 60_000,
      models,
    });

    return models;
  }

  async ensureModel(model: string): Promise<void> {
    try {
      const models = await this.listModels();
      if (!models.includes(model)) {
        throw new Error(
          `Model '${model}' is not available on this provider. Available: ${
            models.join(', ') || '(none)'
          }`,
        );
      }
    } catch (err) {
      // If error is the specific missing model error, rethrow it
      if ((err as Error).message.includes('is not available on this provider')) {
        throw err;
      }
      // If the /models endpoint is not implemented or failed, log warning and resolve anyway
      logger.warn(
        { providerId: this.id, baseUrl: this.rawBaseUrl, err: (err as Error).message },
        'Failed to verify model via /models; resolving anyway',
      );
    }
  }
}
