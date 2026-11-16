// Single responsibility: Integration tests for Provider management API endpoints.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listProvidersHandler,
  createProviderHandler,
  deleteProviderHandler,
  getProviderModelsHandler,
  testProviderHandler,
} from '../modules/providers/providers.controller.js';
import { providerRepo } from '../modules/providers/providers.repo.js';
import type { ProviderRow } from '../db/schema.js';

const inMemoryProviders = new Map<string, ProviderRow>();

function createMockReq(opts: {
  method?: string;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  return {
    method: opts.method || 'GET',
    body: opts.body || {},
    params: opts.params || {},
    query: opts.query || {},
    headers: opts.headers || {},
  } as any;
}

function createMockRes() {
  let statusCode = 200;
  let responseData: any = null;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    send(data?: any) {
      responseData = data;
      return this;
    },
    getStatus: () => statusCode,
    getData: () => responseData,
  } as any;
}

test.before(() => {
  providerRepo.createProvider = async (data: any) => {
    const id = data.id || `prov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row: ProviderRow = {
      id,
      type: data.type,
      label: data.label,
      baseUrl: data.baseUrl,
      apiKeyEnc: data.apiKeyEnc ?? null,
      defaultModel: data.defaultModel ?? null,
      enabled: data.enabled ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryProviders.set(id, row);
    return row;
  };

  providerRepo.getProvider = async (id: string) => {
    return inMemoryProviders.get(id);
  };

  providerRepo.listProviders = async () => {
    return Array.from(inMemoryProviders.values());
  };

  providerRepo.updateProvider = async (id: string, data: any) => {
    const existing = inMemoryProviders.get(id);
    if (!existing) return undefined;
    const updated: ProviderRow = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    inMemoryProviders.set(id, updated);
    return updated;
  };

  providerRepo.deleteProvider = async (id: string) => {
    return inMemoryProviders.delete(id);
  };
});

test('T-IT-01: POST /providers with valid OpenAI payload -> 201, hasKey: true, DB row has non-null api_key_enc', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      type: 'openai',
      label: 'Groq — Llama 3.1 70B',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_1234567890abcdef',
      defaultModel: 'llama-3.1-70b-versatile',
    },
  });
  const res = createMockRes();

  await createProviderHandler(req, res);

  assert.strictEqual(res.getStatus(), 201);
  const data = res.getData();
  assert.ok(data.id);
  assert.strictEqual(data.label, 'Groq — Llama 3.1 70B');
  assert.strictEqual(data.hasKey, true);
  assert.strictEqual(data.apiKey, undefined);
  assert.strictEqual(data.apiKeyEnc, undefined);

  // Verify internal DB representation has apiKeyEnc encrypted
  const stored = inMemoryProviders.get(data.id);
  assert.ok(stored);
  assert.ok(stored.apiKeyEnc);
  assert.notStrictEqual(stored.apiKeyEnc, 'gsk_1234567890abcdef');
});

test('T-IT-02: GET /providers never returns apiKeyEnc or apiKey', async () => {
  const req = createMockReq({ method: 'GET' });
  const res = createMockRes();

  await listProvidersHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const data = res.getData() as any[];
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0);
  for (const item of data) {
    assert.strictEqual(item.apiKey, undefined);
    assert.strictEqual(item.apiKeyEnc, undefined);
    assert.strictEqual(typeof item.hasKey, 'boolean');
  }
});

test('T-IT-03: POST /providers with SSRF URL -> 400', async () => {
  const req = createMockReq({
    method: 'POST',
    body: {
      type: 'openai',
      label: 'SSRF Attempt',
      baseUrl: 'http://169.254.169.254/latest/meta-data',
      apiKey: 'gsk_12345',
    },
  });
  const res = createMockRes();

  await createProviderHandler(req, res);

  assert.strictEqual(res.getStatus(), 400);
  const data = res.getData();
  assert.strictEqual(data.error, 'Invalid URL');
});

test('T-IT-04: DELETE /providers/:id -> 204', async () => {
  const createReq = createMockReq({
    method: 'POST',
    body: {
      type: 'openai',
      label: 'To Delete',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-delete-me',
    },
  });
  const createRes = createMockRes();
  await createProviderHandler(createReq, createRes);
  const created = createRes.getData();

  const deleteReq = createMockReq({
    method: 'DELETE',
    params: { id: created.id },
  });
  const deleteRes = createMockRes();
  await deleteProviderHandler(deleteReq, deleteRes);
  assert.strictEqual(deleteRes.getStatus(), 204);

  const getReq = createMockReq({
    method: 'GET',
    params: { id: created.id },
  });
  const getRes = createMockRes();
  await getProviderModelsHandler(getReq, getRes);
  assert.strictEqual(getRes.getStatus(), 404);
});

test('T-IT-05: GET /providers/:id/models (mock upstream) -> 200, cached on second call', async () => {
  let upstreamFetchCount = 0;
  const originalFetch = globalThis.fetch;

  try {
    const createReq = createMockReq({
      method: 'POST',
      body: {
        type: 'openai',
        label: 'Models Cache Test',
        baseUrl: 'https://api.together.xyz/v1',
        apiKey: 'tog_123',
      },
    });
    const createRes = createMockRes();
    await createProviderHandler(createReq, createRes);
    const created = createRes.getData();

    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        upstreamFetchCount++;
        return new Response(
          JSON.stringify({
            data: [{ id: 'model-a' }, { id: 'model-b' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    }) as any;

    // First call
    const getReq1 = createMockReq({ params: { id: created.id } });
    const getRes1 = createMockRes();
    await getProviderModelsHandler(getReq1, getRes1);

    assert.strictEqual(getRes1.getStatus(), 200);
    const data1 = getRes1.getData();
    assert.deepStrictEqual(data1.models, [
      { id: 'model-a', name: 'model-a' },
      { id: 'model-b', name: 'model-b' },
    ]);
    assert.strictEqual(upstreamFetchCount, 1);

    // Second call (must be cached)
    const getReq2 = createMockReq({ params: { id: created.id } });
    const getRes2 = createMockRes();
    await getProviderModelsHandler(getReq2, getRes2);

    assert.strictEqual(getRes2.getStatus(), 200);
    const data2 = getRes2.getData();
    assert.deepStrictEqual(data2.models, [
      { id: 'model-a', name: 'model-a' },
      { id: 'model-b', name: 'model-b' },
    ]);
    assert.strictEqual(upstreamFetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-IT-06: POST /providers/:id/test (mock 401) -> 200 { ok: false, error }', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const createReq = createMockReq({
      method: 'POST',
      body: {
        type: 'openai',
        label: 'Auth Failure Test',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-invalid',
      },
    });
    const createRes = createMockRes();
    await createProviderHandler(createReq, createRes);
    const created = createRes.getData();

    globalThis.fetch = (async (input: any) => {
      const urlStr = String(input);
      if (urlStr.includes('/models')) {
        return new Response('401 Unauthorized', { status: 401 });
      }
      return new Response('{}', { status: 200 });
    }) as any;

    const testReq = createMockReq({ params: { id: created.id } });
    const testRes = createMockRes();
    await testProviderHandler(testReq, testRes);

    assert.strictEqual(testRes.getStatus(), 200);
    const result = testRes.getData();
    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
