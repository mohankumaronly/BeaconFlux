// Single responsibility: Tests for frontend Chat CRUD API client functions (rename, delete, pin, export).

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setApiToken,
  renameChat,
  deleteChat,
  pinChat,
  exportChat,
} from '../lib/api';

// Mock localStorage for node environment
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, String(val)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
  get length() {
    return storage.size;
  },
};

(globalThis as any).localStorage = mockLocalStorage;
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  storage.clear();
  setApiToken('test-token-12345');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('T-FE-A-01: renameChat(42, "New title") sends PATCH with auth header and body', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        id: 42,
        title: 'New title',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        pinned: false,
        pinnedAt: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as any;

  const result = await renameChat(42, 'New title');

  assert.strictEqual(capturedUrl, '/api/v1/chats/42');
  assert.strictEqual(capturedInit?.method, 'PATCH');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.strictEqual(headers?.['Authorization'], 'Bearer test-token-12345');
  assert.strictEqual(headers?.['Content-Type'], 'application/json');
  assert.strictEqual(capturedInit?.body, '{"title":"New title"}');
  assert.strictEqual(result.id, 42);
  assert.strictEqual(result.title, 'New title');
  assert.strictEqual(result.pinned, false);
  assert.strictEqual(result.pinnedAt, null);
});

test('T-FE-A-02: deleteChat(42) sends DELETE with auth header and resolves on 204', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(null, { status: 204 });
  }) as any;

  const result = await deleteChat(42);

  assert.strictEqual(capturedUrl, '/api/v1/chats/42');
  assert.strictEqual(capturedInit?.method, 'DELETE');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.strictEqual(headers?.['Authorization'], 'Bearer test-token-12345');
  assert.strictEqual(result, undefined);
});

test('T-FE-A-03: pinChat(42, true) sends PATCH with pinned body and returns ChatSummary', async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        id: 42,
        title: 'Pinned Chat',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        pinned: true,
        pinnedAt: '2026-01-01T12:00:00.000Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as any;

  const result = await pinChat(42, true);

  assert.strictEqual(capturedUrl, '/api/v1/chats/42/pin');
  assert.strictEqual(capturedInit?.method, 'PATCH');
  const headers = capturedInit?.headers as Record<string, string>;
  assert.strictEqual(headers?.['Authorization'], 'Bearer test-token-12345');
  assert.strictEqual(headers?.['Content-Type'], 'application/json');
  assert.strictEqual(capturedInit?.body, '{"pinned":true}');
  assert.strictEqual(result.pinned, true);
  assert.strictEqual(result.pinnedAt, '2026-01-01T12:00:00.000Z');
});

test('T-FE-A-04: exportChat(42, "md") and exportChat(42) request correct URLs and return Blob', async () => {
  let capturedUrl: string | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    return new Response('# Chat Title\n\n_Exported_', {
      status: 200,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }) as any;

  const blobMd = await exportChat(42, 'md');
  assert.ok(capturedUrl?.includes('?format=md'));
  assert.ok(blobMd instanceof Blob);
  assert.ok(blobMd.type.includes('text/markdown'));

  // Default format argument should be 'md'
  await exportChat(42);
  assert.ok(capturedUrl?.includes('?format=md'));
});

test('T-FE-A-05: error handling throws expected Error messages on failure status codes', async () => {
  // renameChat 404
  globalThis.fetch = (async () => new Response('Not Found', { status: 404 })) as any;
  await assert.rejects(
    () => renameChat(42, 'Title'),
    /renameChat failed: 404/,
  );

  // deleteChat 500
  globalThis.fetch = (async () => new Response('Server Error', { status: 500 })) as any;
  await assert.rejects(
    () => deleteChat(42),
    /deleteChat failed: 500/,
  );

  // pinChat 403
  globalThis.fetch = (async () => new Response('Forbidden', { status: 403 })) as any;
  await assert.rejects(
    () => pinChat(42, true),
    /pinChat failed: 403/,
  );

  // exportChat 400
  globalThis.fetch = (async () => new Response('Bad Request', { status: 400 })) as any;
  await assert.rejects(
    () => exportChat(42, 'md'),
    /exportChat failed: 400/,
  );
});
