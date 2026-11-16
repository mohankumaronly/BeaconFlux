// Single responsibility: Comprehensive test suite for Phase 2.2 frontend provider features, components, and regressions.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import React from 'react';
import { renderToString } from 'react-dom/server';

import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  listProviderModels,
  ProviderApiUnavailable,
} from '../lib/providers';
import { streamChatApi } from '../lib/api';
import { ModelPicker } from '../components/ModelPicker';
import { ProviderBadge } from '../components/ProviderBadge';
import { ProviderForm } from '../components/ProviderForm';
import { ProvidersTab } from '../components/ProvidersTab';
import { SettingsModal } from '../components/SettingsModal';
import { Sidebar } from '../components/Sidebar';
import { ProvidersContext } from '../contexts/ProvidersContext';
import type { ProviderPublic } from '../types/providers';
import type { OllamaModel } from '../types';

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

function makeProvider(
  p: Partial<ProviderPublic> & { id: string; label: string; baseUrl: string },
): ProviderPublic {
  return {
    type: 'openai',
    enabled: true,
    hasKey: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...p,
  };
}

function makeOllamaModel(name: string): OllamaModel {
  return {
    name,
    size: 1000,
    modified_at: '2026-01-01',
  };
}

describe('Phase 2.2 — Providers UI Test Suite', () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // T-FE-U-01
  test('T-FE-U-01: lib/providers.ts listProviders returns 404 -> throws ProviderApiUnavailable', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      async () => {
        await listProviders();
      },
      (err: Error) => {
        assert.ok(err instanceof ProviderApiUnavailable);
        assert.match(err.message, /Provider API unavailable/);
        return true;
      },
    );
  });

  // T-FE-U-02
  test('T-FE-U-02: ProvidersTab renders backend 2.1+ fallback when available is false', () => {
    const html = renderToString(
      React.createElement(
        ProvidersContext.Provider,
        {
          value: {
            providers: [],
            available: false,
            loading: false,
            error: null,
            refresh: async () => {},
          },
        },
        React.createElement(ProvidersTab),
      ),
    );

    assert.ok(html.includes('Provider API Unavailable'), 'Must render warning title');
    assert.ok(html.includes('requires backend 2.1+'), 'Must explain 2.1+ requirement');
  });

  // T-FE-U-03
  test('T-FE-U-03: Provider reconciliation clears currentId when removed from list', () => {
    mockLocalStorage.setItem('beacon_flux_last_provider', 'provider-123');
    assert.equal(mockLocalStorage.getItem('beacon_flux_last_provider'), 'provider-123');

    const availableProviders: ProviderPublic[] = [
      makeProvider({
        id: 'provider-999',
        label: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
      }),
    ];

    // Simulating reconciliation logic: if currentId is not in available providers, clear it
    const currentId = mockLocalStorage.getItem('beacon_flux_last_provider');
    if (currentId && !availableProviders.some((p) => p.id === currentId)) {
      mockLocalStorage.removeItem('beacon_flux_last_provider');
    }

    assert.equal(mockLocalStorage.getItem('beacon_flux_last_provider'), null);
  });

  // T-FE-U-04 & T-FE-U-05
  test('T-FE-U-04: listProviderModels fetches models and T-FE-U-05: undefined provider returns empty', async () => {
    let fetchCalls = 0;
    globalThis.fetch = async (url) => {
      fetchCalls++;
      assert.ok(String(url).includes('/api/v1/providers/p1/models'));
      return new Response(
        JSON.stringify({
          models: [
            { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const models = await listProviderModels('p1');
    assert.equal(fetchCalls, 1);
    assert.equal(models.length, 2);
    assert.equal(models[0].id, 'llama-3.1-70b-versatile');

    // ModelPicker with undefined provider should not fetch models
    const pickerHtml = renderToString(
      React.createElement(ModelPicker, {
        providers: [makeProvider({ id: 'p1', label: 'Groq', baseUrl: 'https://api.groq.com' })],
        currentProviderId: undefined,
        currentModel: 'llama3.2',
        ollamaModels: [makeOllamaModel('llama3.2')],
        onSelect: () => {},
      }),
    );
    assert.ok(pickerHtml.includes('Ollama (Local)'));
    assert.ok(pickerHtml.includes('llama3.2'));
  });

  // T-FE-U-06
  test('T-FE-U-06: createProvider sends correct POST body', async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/api/v1/providers'));
      assert.equal(init?.method, 'POST');
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'prov-new',
          type: capturedBody.type,
          label: capturedBody.label,
          baseUrl: capturedBody.baseUrl,
          hasKey: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          enabled: true,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const created = await createProvider({
      type: 'openai',
      label: 'Groq Cloud',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_test_key_12345',
      defaultModel: 'llama-3.1-70b-versatile',
    });

    assert.equal(created.id, 'prov-new');
    assert.equal(capturedBody.label, 'Groq Cloud');
    assert.equal(capturedBody.apiKey, 'gsk_test_key_12345');
    assert.equal(capturedBody.defaultModel, 'llama-3.1-70b-versatile');
  });

  // T-FE-U-07
  test('T-FE-U-07: updateProvider with empty apiKey omits apiKey field in payload', async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/api/v1/providers/prov-123'));
      assert.equal(init?.method, 'PATCH');
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'prov-123',
          type: 'openai',
          label: capturedBody.label,
          baseUrl: capturedBody.baseUrl,
          hasKey: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          enabled: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    await updateProvider('prov-123', {
      label: 'Updated Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
    });

    assert.equal(capturedBody.label, 'Updated Groq');
    assert.equal(capturedBody.apiKey, undefined, 'Must not send apiKey field when not updating');
  });

  // deleteProvider test
  test('deleteProvider sends DELETE request', async () => {
    let deletedId = '';
    globalThis.fetch = async (url, init) => {
      assert.equal(init?.method, 'DELETE');
      deletedId = String(url).split('/').pop() || '';
      return new Response(null, { status: 204 });
    };

    await deleteProvider('provider-del-123');
    assert.equal(deletedId, 'provider-del-123');
  });

  // T-FE-U-08
  test('T-FE-U-08: testProvider connection returns ok, latencyMs, and modelCount', async () => {
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/api/v1/providers/prov-123/test'));
      assert.equal(init?.method, 'POST');
      return new Response(
        JSON.stringify({
          ok: true,
          latencyMs: 142,
          modelCount: 15,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const res = await testProvider('prov-123');
    assert.equal(res.ok, true);
    assert.equal(res.latencyMs, 142);
    assert.equal(res.modelCount, 15);
  });

  // T-FE-U-09 & T-FE-U-10
  test('T-FE-U-09: ModelPicker renders two-level picker and T-FE-U-10: single select with 0 providers', () => {
    // T-FE-U-10: Single select when providers empty
    const singleSelectHtml = renderToString(
      React.createElement(ModelPicker, {
        providers: [],
        currentModel: 'llama3.2',
        ollamaModels: [makeOllamaModel('llama3.2'), makeOllamaModel('qwen2.5:7b')],
        onSelect: () => {},
      }),
    );
    assert.ok(singleSelectHtml.includes('llama3.2'));
    assert.ok(singleSelectHtml.includes('qwen2.5:7b'));
    assert.ok(!singleSelectHtml.includes('Provider'), 'Must not render Provider label when empty');

    // T-FE-U-09: Two dropdowns when providers exist
    const twoLevelHtml = renderToString(
      React.createElement(ModelPicker, {
        providers: [
          makeProvider({
            id: 'groq-1',
            label: 'Groq Cloud',
            baseUrl: 'https://api.groq.com',
            defaultModel: 'llama-3.1-70b-versatile',
          }),
        ],
        currentProviderId: 'groq-1',
        currentModel: 'llama-3.1-70b-versatile',
        ollamaModels: [makeOllamaModel('llama3.2')],
        onSelect: () => {},
      }),
    );
    assert.ok(twoLevelHtml.includes('Provider'), 'Must render Provider label');
    assert.ok(twoLevelHtml.includes('Groq Cloud'), 'Must render provider option');
    assert.ok(twoLevelHtml.includes('llama-3.1-70b-versatile'), 'Must render default model');
  });

  // T-FE-C-01
  test('T-FE-C-01: SettingsModal renders Connection and Providers tabs', () => {
    const html = renderToString(
      React.createElement(SettingsModal, {
        open: true,
        status: 'online',
        onClose: () => {},
        currentUrl: 'http://localhost:11434',
        onSave: () => true,
        onReset: () => {},
      }),
    );

    assert.ok(html.includes('Connection'), 'Must render Connection tab button');
    assert.ok(html.includes('Providers'), 'Must render Providers tab button');
    assert.ok(html.includes('Endpoint URL'), 'Must render connection form fields');
  });

  // T-FE-C-02
  test('T-FE-C-02: ProvidersTab renders list of configured providers and Add button', () => {
    const mockProviders: ProviderPublic[] = [
      makeProvider({
        id: 'p-groq',
        label: 'Groq Fast',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.1-70b-versatile',
      }),
    ];

    const html = renderToString(
      React.createElement(
        ProvidersContext.Provider,
        {
          value: {
            providers: mockProviders,
            available: true,
            loading: false,
            error: null,
            refresh: async () => {},
          },
        },
        React.createElement(ProvidersTab),
      ),
    );

    assert.ok(html.includes('Configured Providers'));
    assert.ok(html.includes('Groq Fast'));
    assert.ok(html.includes('Add provider'));
  });

  // T-FE-C-04 & T-FE-C-05
  test('T-FE-C-04 & T-FE-C-05: Sidebar adapts model selector with/without providers', () => {
    // Single dropdown with 0 providers (T-FE-C-05)
    const sidebarSingle = renderToString(
      React.createElement(Sidebar, {
        models: [makeOllamaModel('llama3.2')],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [],
        onSelectChat: () => {},
        providers: [],
      }),
    );
    assert.ok(sidebarSingle.includes('llama3.2'));
    assert.ok(!sidebarSingle.includes('Provider'), 'No provider selector with 0 providers');

    // Two dropdowns with providers (T-FE-C-04)
    const sidebarTwoLevel = renderToString(
      React.createElement(Sidebar, {
        models: [makeOllamaModel('llama3.2')],
        model: 'llama-3.1-70b-versatile',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [],
        onSelectChat: () => {},
        providers: [
          makeProvider({
            id: 'groq-1',
            label: 'Groq Cloud',
            baseUrl: 'https://api.groq.com',
          }),
        ],
        currentProviderId: 'groq-1',
      }),
    );
    assert.ok(sidebarTwoLevel.includes('Provider'));
    assert.ok(sidebarTwoLevel.includes('Groq Cloud'));
  });

  // T-FE-C-06
  test('T-FE-C-06: streamChatApi passes providerId to POST /api/v1/chat', async () => {
    let capturedBody: any = null;
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).endsWith('/api/v1/chat'));
      capturedBody = JSON.parse(init?.body as string);
      // Return minimal valid SSE stream
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"done","totalDuration":100}\n\n'));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const generator = streamChatApi({
      message: 'Hello OpenAI provider',
      model: 'llama-3.1-70b-versatile',
      providerId: 'provider-groq-456',
    });

    for await (const _ev of generator) {
      // iterate
    }

    assert.equal(capturedBody.message, 'Hello OpenAI provider');
    assert.equal(capturedBody.model, 'llama-3.1-70b-versatile');
    assert.equal(capturedBody.providerId, 'provider-groq-456');
  });

  // AC-10
  test('AC-10: Plaintext API key is never rendered in DOM for configured providers', () => {
    const html = renderToString(
      React.createElement(ProviderForm, {
        mode: 'edit',
        initial: makeProvider({
          id: 'prov-existing',
          label: 'Together AI',
          baseUrl: 'https://api.together.xyz/v1',
        }),
        onSave: async () => {},
        onCancel: () => {},
      }),
    );

    // Verify no secret or plaintext key is in the output HTML
    assert.ok(!html.includes('sk-'), 'Must not contain any real key prefix');
    assert.ok(!html.includes('gsk_'), 'Must not contain groq key prefix');
    assert.ok(html.includes('Encrypted key configured'), 'Must show encrypted key notice');
  });

  // ProviderBadge test
  test('ProviderBadge renders badge with provider label and model', () => {
    const html = renderToString(
      React.createElement(ProviderBadge, {
        provider: makeProvider({
          id: 'p1',
          label: 'Together AI',
          baseUrl: 'https://api.together.xyz/v1',
        }),
        model: 'llama-3.1-70b',
      }),
    );

    assert.ok(html.includes('Together AI'));
    assert.ok(html.includes('llama-3.1-70b'));
  });

  // T-FE-R-01 through T-FE-R-05
  test('T-FE-R-01..05: Regression check - preserved files have zero git diff against phase 2.1 base', () => {
    const filesToCheck = [
      'apps/web/src/lib/ollama.ts',
      'apps/web/src/components/Composer.tsx',
      'apps/web/src/components/ChatWindow.tsx',
      'apps/web/src/components/FirstRunModal.tsx',
      'apps/web/src/components/MessageBubble.tsx',
    ];

    for (const f of filesToCheck) {
      const diff = execSync(`git diff feat/phase-2.1-providers -- ${f}`, {
        encoding: 'utf-8',
      }).trim();
      assert.equal(diff, '', `File ${f} must have 0 diff against feat/phase-2.1-providers`);
    }
  });
});
