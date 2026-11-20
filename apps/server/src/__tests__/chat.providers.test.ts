// Single responsibility: Integration and E2E tests for chat flows via Ollama and OpenAI providers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { postChat } from '../modules/chat/chat.controller.js';
import { db } from '../db/client.js';
import { providerRepo } from '../modules/providers/providers.repo.js';
import { encrypt } from '../lib/crypto.js';
import type { ProviderRow, Chat, Message } from '../db/schema.js';

const inMemoryProviders = new Map<string, ProviderRow>();
const inMemoryChats = new Map<number, Chat>();
const inMemoryMessages = new Map<number, Message[]>();
let nextChatId = 1;
let nextMessageId = 1;

function createMockReq(body: any, closeEmitter?: { on: (event: string, fn: () => void) => void }) {
  return {
    body,
    headers: {},
    on: closeEmitter ? closeEmitter.on : (_event: string, _fn: () => void) => {},
  } as any;
}

function createMockRes() {
  let statusCode = 200;
  let responseData: any = null;
  const headers = new Map<string, string>();
  const writtenChunks: string[] = [];
  let isClosed = false;

  const res = {
    writableEnded: false,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    setHeader(k: string, v: string) {
      headers.set(k, v);
      return this;
    },
    flushHeaders() {},
    write(chunk: string) {
      writtenChunks.push(chunk);
      return true;
    },
    end() {
      this.writableEnded = true;
      isClosed = true;
      return this;
    },
    on(_ev: string, _fn: () => void) {},
    getStatus: () => statusCode,
    getData: () => responseData,
    getChunks: () => writtenChunks,
    isEnded: () => isClosed,
  };
  return res as any;
}

test.before(() => {
  // Stub db operations on client.db without touching chat.repo.ts
  (db as any).insert = (table: any) => {
    return {
      values: (val: any) => {
        return {
          returning: async () => {
            if (table.title) {
              // Inserting into chats
              const chat: Chat = {
                id: nextChatId++,
                title: val.title || 'New chat',
                providerId: val.providerId ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
                pinned: false,
                pinnedAt: null,
              };
              inMemoryChats.set(chat.id, chat);
              inMemoryMessages.set(chat.id, []);
              return [chat];
            } else {
              // Inserting into messages
              const msg: Message = {
                id: nextMessageId++,
                chatId: val.chatId,
                role: val.role,
                content: val.content,
                providerId: val.providerId ?? null,
                model: val.model ?? null,
                meta: val.meta ?? null,
                createdAt: new Date(),
              };
              const list = inMemoryMessages.get(val.chatId) || [];
              list.push(msg);
              inMemoryMessages.set(val.chatId, list);
              return [msg];
            }
          },
        };
      },
    };
  };

  (db as any).select = () => {
    return {
      from: (table: any) => {
        return {
          where: (_cond: any) => {
            return {
              limit: async () => {
                // getChat
                return Array.from(inMemoryChats.values()).slice(0, 1);
              },
              orderBy: async () => {
                // listMessages
                const all = Array.from(inMemoryMessages.values()).flat();
                return all;
              },
            };
          },
          orderBy: async () => {
            return Array.from(inMemoryChats.values());
          },
        };
      },
    };
  };

  (db as any).update = () => {
    return {
      set: () => {
        return {
          where: async () => {
            return [];
          },
        };
      },
    };
  };

  // Provider repo stubs
  providerRepo.getProvider = async (id: string) => inMemoryProviders.get(id);
});

test('T-IT-08: POST /chat with no providerId, no ollamaUrl -> uses env.OLLAMA_URL, works', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/api/chat')) {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ message: { role: 'assistant', content: 'Hello from Ollama' }, done: false }) + '\n',
              ),
            );
            controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({ message: 'Hello', model: 'llama3.2' });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 200);
    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('chat_created'));
    assert.ok(chunks.includes('Hello from Ollama'));
    assert.ok(chunks.includes('"type":"done"'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-IT-09: POST /chat with ollamaUrl only -> applies SSRF check', async () => {
  const req = createMockReq({
    message: 'Hello',
    model: 'llama3.2',
    ollamaUrl: 'http://169.254.169.254:11434',
  });
  const res = createMockRes();

  await postChat(req, res);

  assert.strictEqual(res.getStatus(), 400);
  assert.strictEqual(res.getData().error, 'URL not allowed');
});

test('T-IT-10: POST /chat with providerId for disabled provider -> 404', async () => {
  const disabledId = '00000000-0000-0000-0000-000000000001';
  inMemoryProviders.set(disabledId, {
    id: disabledId,
    type: 'openai',
    label: 'Disabled Provider',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const req = createMockReq({
    message: 'Hello',
    model: 'gpt-4o',
    providerId: disabledId,
  });
  const res = createMockRes();

  await postChat(req, res);

  assert.strictEqual(res.getStatus(), 404);
  assert.strictEqual(res.getData().error, 'Provider not found');
});

test('T-IT-11: POST /chat model absent from provider -> 400 Model unavailable', async () => {
  const validProvId = '00000000-0000-0000-0000-000000000002';
  inMemoryProviders.set(validProvId, {
    id: validProvId,
    type: 'openai',
    label: 'Test OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({
      message: 'Hello',
      model: 'non-existent-model',
      providerId: validProvId,
    });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 400);
    assert.strictEqual(res.getData().error, 'Model unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-IT-07 / T-E2E-01: POST /chat with providerId (mock OpenAI SSE) -> tokens delivered', async () => {
  const validProvId = '00000000-0000-0000-0000-000000000003';
  inMemoryProviders.set(validProvId, {
    id: validProvId,
    type: 'openai',
    label: 'OpenAI Stream',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/chat/completions')) {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"OpenAI says hi"}}]}\n\n'),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({
      message: 'Hi there',
      model: 'gpt-4o',
      providerId: validProvId,
    });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 200);
    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('OpenAI says hi'));
    assert.ok(chunks.includes('"type":"done"'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-E2E-03: Chat via mock OpenAI with web_search tool call -> service loop runs & feeds context', async () => {
  const provId = '00000000-0000-0000-0000-000000000004';
  inMemoryProviders.set(provId, {
    id: provId,
    type: 'openai',
    label: 'Tool Test',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const originalFetch = globalThis.fetch;
  let chatCallCount = 0;

  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/chat/completions')) {
        chatCallCount++;
        const encoder = new TextEncoder();

        if (chatCallCount === 1) {
          // First pass: AI decides to call web_search
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_search_1","function":{"name":"web_search","arguments":"{\\"query\\":\\"Node 24 features\\"}"}}]}}]}\n\n',
                ),
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        } else {
          // Second pass: AI returns final answer with search context
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"Node 24 includes latest V8 engine."}}]}\n\n',
                ),
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        }
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({
      message: 'What is new in Node 24?',
      model: 'gpt-4o',
      providerId: provId,
    });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(chatCallCount, 2);
    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('Searching the web for'));
    assert.ok(chunks.includes('Node 24 features'));
    assert.ok(chunks.includes('Node 24 includes latest V8 engine.'));
    assert.ok(chunks.includes('"type":"done"'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-E2E-04: Chat via mock OpenAI with multiple tool calls in one response -> handles index 0 gracefully', async () => {
  const provId = '00000000-0000-0000-0000-000000000005';
  inMemoryProviders.set(provId, {
    id: provId,
    type: 'openai',
    label: 'Multi Tool Test',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const originalFetch = globalThis.fetch;
  let chatCallCount = 0;

  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/chat/completions')) {
        chatCallCount++;
        const encoder = new TextEncoder();

        if (chatCallCount === 1) {
          // Returns two tool calls in the same stream
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"web_search","arguments":"{\\"query\\":\\"first query\\"}"}},{"index":1,"id":"call_2","function":{"name":"fetch_url","arguments":"{\\"url\\":\\"https://example.com\\"}"}}]}}]}\n\n',
                ),
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        } else {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"Final answer without crash"}}]}\n\n',
                ),
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        }
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({
      message: 'Multi query',
      model: 'gpt-4o',
      providerId: provId,
    });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 200);
    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('Searching the web for'));
    assert.ok(chunks.includes('first query'));
    assert.ok(chunks.includes('Final answer without crash'));
    assert.ok(chunks.includes('"type":"done"'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('T-E2E-02: Chat via Ollama with tool -> web search fires & sources event emitted', async () => {
  const originalFetch = globalThis.fetch;
  let ollamaCallCount = 0;

  try {
    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/search')) {
        // Mock SearXNG response
        return new Response(
          JSON.stringify({
            results: [
              {
                title: 'Node.js Official',
                url: 'https://nodejs.org',
                content: 'Node.js is an open-source, cross-platform JavaScript runtime.',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (urlStr.includes('/api/chat')) {
        ollamaCallCount++;
        const encoder = new TextEncoder();
        if (ollamaCallCount === 1) {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    message: {
                      role: 'assistant',
                      tool_calls: [
                        {
                          function: {
                            name: 'web_search',
                            arguments: { query: 'Nodejs runtime' },
                          },
                        },
                      ],
                    },
                    done: false,
                  }) + '\n',
                ),
              );
              controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        } else {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    message: { role: 'assistant', content: 'Node is great[1].' },
                    done: false,
                  }) + '\n',
                ),
              );
              controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'));
              controller.close();
            },
          });
          return new Response(stream, { status: 200 });
        }
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq({
      message: 'Tell me about Node.js',
      model: 'llama3.2',
    });
    const res = createMockRes();

    await postChat(req, res);

    assert.strictEqual(res.getStatus(), 200);
    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('"type":"sources"'));
    assert.ok(chunks.includes('https://nodejs.org'));
    assert.ok(chunks.includes('Node is great[1].'));
    assert.ok(chunks.includes('"type":"done"'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-E2E-05: Client disconnects mid-stream -> partial assistant message saved', async () => {
  const provId = '00000000-0000-0000-0000-000000000006';
  inMemoryProviders.set(provId, {
    id: provId,
    type: 'openai',
    label: 'Abort Test',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnc: encrypt('test-key'),
    defaultModel: 'gpt-4o',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const originalFetch = globalThis.fetch;
  try {
    let closeListener: (() => void) | undefined;
    const closeEmitter = {
      on: (ev: string, fn: () => void) => {
        if (ev === 'close') closeListener = fn;
      },
    };

    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/chat/completions')) {
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"Partial start"}}]}\n\n'),
            );
            // Simulate client disconnect mid-stream
            setTimeout(() => {
              if (closeListener) closeListener();
            }, 10);
            await new Promise((r) => setTimeout(r, 50));
            try {
              controller.enqueue(
                encoder.encode('data: {"choices":[{"delta":{"content":"After close"}}]}\n\n'),
              );
              controller.close();
            } catch {
              // stream aborted
            }
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const req = createMockReq(
      {
        message: 'Abort test',
        model: 'gpt-4o',
        providerId: provId,
      },
      closeEmitter,
    );
    const res = createMockRes();

    await postChat(req, res);

    const chunks = res.getChunks().join('');
    assert.ok(chunks.includes('Partial start'));
    // Verify an assistant message was saved in memory
    const allMsgs = Array.from(inMemoryMessages.values()).flat();
    const savedAssistant = allMsgs.find(
      (m) => m.role === 'assistant' && m.content.includes('Partial start'),
    );
    assert.ok(savedAssistant);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
