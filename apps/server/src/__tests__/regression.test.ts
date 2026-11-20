// Single responsibility: Regression tests verifying authentication, chat persistence, and agent loop bounds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { streamChat } from '../modules/chat/chat.service.js';
import { touchChat } from '../modules/chat/chat.repo.js';
import { db } from '../db/client.js';
import { env } from '../config/env.js';
import type { Provider, ProviderStreamChunk } from '../providers/base.provider.js';
import type { Chat, Message } from '../db/schema.js';

test('T-REG-03: GET /api/v1/auth/verify returns 200 with valid bearer token', async () => {
  const app = createApp();
  let statusCode = 200;
  let responseBody: any = null;

  const req = {
    method: 'GET',
    url: '/api/v1/auth/verify',
    headers: {
      authorization: `Bearer ${env.API_TOKEN}`,
    },
  } as any;

  await new Promise<void>((resolve) => {
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        resolve();
        return this;
      },
      setHeader() {
        return this;
      },
      end() {
        resolve();
        return this;
      },
    } as any;

    (app as any).handle(req, res, () => resolve());
  });

  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseBody.ok, true);
});

test('T-REG-04: POST /api/v1/chat without auth header returns 401', async () => {
  const app = createApp();
  let statusCode = 200;
  let responseBody: any = null;

  const req = {
    method: 'POST',
    url: '/api/v1/chat',
    headers: {},
  } as any;

  await new Promise<void>((resolve) => {
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        resolve();
        return this;
      },
      setHeader() {
        return this;
      },
      end() {
        resolve();
        return this;
      },
    } as any;

    (app as any).handle(req, res, () => resolve());
  });

  assert.strictEqual(statusCode, 401);
  assert.deepStrictEqual(responseBody, { error: 'Unauthorized' });
});

test('T-REG-02: Existing chat with provider_id = NULL loads and send message works', async () => {
  const existingChat: Chat = {
    id: 999,
    title: 'Pre-2.1 Legacy Chat',
    providerId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const existingMessage: Message = {
    id: 1001,
    chatId: 999,
    role: 'user',
    content: 'Prior user question',
    providerId: null,
    model: null,
    meta: null,
    createdAt: new Date('2026-01-01'),
  };

  (db as any).select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => [existingChat],
        orderBy: async () => [existingMessage],
      }),
    }),
  });

  (db as any).insert = () => ({
    values: (val: any) => ({
      returning: async () => [
        {
          id: 1002,
          chatId: 999,
          role: val.role,
          content: val.content,
          providerId: null,
          model: null,
          meta: null,
          createdAt: new Date(),
        },
      ],
    }),
  });

  (db as any).update = () => ({
    set: () => ({
      where: async () => [],
    }),
  });

  const mockProvider: Provider = {
    id: 'env-ollama',
    type: 'ollama',
    async *chatStream(): AsyncGenerator<ProviderStreamChunk> {
      yield { type: 'token', text: 'Legacy chat reply' };
      yield { type: 'done' };
    },
    listModels: async () => ['llama3.2'],
    ensureModel: async () => {},
  };

  const events = [];
  for await (const event of streamChat({
    chatId: 999,
    userMessage: 'New follow-up message',
    model: 'llama3.2',
    provider: mockProvider,
  })) {
    events.push(event);
  }

  assert.ok(events.some((e) => e.type === 'token' && e.text === 'Legacy chat reply'));
  assert.ok(events.some((e) => e.type === 'done' && (e as any).chatId === 999));
});

test('T-REG-08: chat.service.ts agent loop caps at MAX_LOOPS = 3', async () => {
  let loopsCount = 0;
  const mockLoopProvider: Provider = {
    id: 'loop-prov',
    type: 'openai',
    async *chatStream(): AsyncGenerator<ProviderStreamChunk> {
      loopsCount++;
      yield {
        type: 'tool_calls',
        toolCalls: [
          {
            id: `call_${loopsCount}`,
            function: {
              name: 'web_search',
              arguments: { query: `loop test ${loopsCount}` },
            },
          },
        ],
      };
      yield { type: 'done' };
    },
    listModels: async () => ['gpt-4o'],
    ensureModel: async () => {},
  };

  (db as any).insert = () => ({
    values: (val: any) => ({
      returning: async () => [{ id: 1, ...val, createdAt: new Date() }],
    }),
  });
  (db as any).select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: 1, title: 'Chat', providerId: null, createdAt: new Date(), updatedAt: new Date() }],
        orderBy: async () => [],
      }),
    }),
  });
  (db as any).update = () => ({
    set: () => ({
      where: async () => [],
    }),
  });

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as any;

    const events = [];
    for await (const event of streamChat({
      chatId: 1,
      userMessage: 'Start endless loop',
      model: 'gpt-4o',
      provider: mockLoopProvider,
    })) {
      events.push(event);
    }

    assert.ok(loopsCount <= 3);
    assert.ok(events.some((e) => e.type === 'done'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-REG-09: touchChat preserves pinned and pinnedAt', async () => {
  let capturedPayload: any = null;
  (db as any).update = () => ({
    set: (payload: any) => {
      capturedPayload = payload;
      return { where: async () => [] };
    },
  });

  await touchChat(1);

  assert.ok(capturedPayload);
  assert.ok('updatedAt' in capturedPayload);
  assert.strictEqual('pinned' in capturedPayload, false);
  assert.strictEqual('pinnedAt' in capturedPayload, false);
});

