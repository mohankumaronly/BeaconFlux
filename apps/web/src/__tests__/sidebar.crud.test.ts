// Single responsibility: Sidebar CRUD UI tests verifying kebab menu, pinned section, inline rename, and ConfirmDialog.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Sidebar } from '../components/Sidebar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ChatSummary } from '../lib/api';
import type { ProviderPublic } from '../types/providers';

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

function makeChat(
  overrides: Partial<ChatSummary> & { id: number; title: string },
): ChatSummary {
  return {
    id: overrides.id,
    title: overrides.title,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    pinned: overrides.pinned ?? false,
    pinnedAt: overrides.pinnedAt ?? null,
  };
}

describe('Sidebar CRUD UI Test Suite', () => {
  test('T-FE-S-01: Kebab button rendered per chat row with aria-label="Chat actions" when CRUD prop passed', () => {
    const chat = makeChat({ id: 1, title: 'Chat One' });
    const html = renderToString(
      React.createElement(Sidebar, {
        models: [],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [chat],
        activeChatId: 1,
        onSelectChat: () => {},
        onRename: () => {},
      }),
    );
    assert.ok(html.includes('aria-label="Chat actions"'));
  });

  test('T-FE-S-02: Pinned chats render in "Pinned" heading section ABOVE date-group heading', () => {
    const now = new Date().toISOString();
    const pinnedChat = makeChat({
      id: 1,
      title: 'Pinned Chat',
      pinned: true,
      pinnedAt: now,
    });
    const regularChat = makeChat({
      id: 2,
      title: 'Today Chat',
      pinned: false,
      updatedAt: now,
    });

    const html = renderToString(
      React.createElement(Sidebar, {
        models: [],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [pinnedChat, regularChat],
        activeChatId: undefined,
        onSelectChat: () => {},
      }),
    );

    const pinnedIndex = html.indexOf('Pinned');
    const todayIndex = html.indexOf('Today');
    assert.ok(pinnedIndex !== -1, 'Must contain "Pinned" section');
    assert.ok(todayIndex !== -1, 'Must contain "Today" section');
    assert.ok(pinnedIndex < todayIndex, '"Pinned" must appear before "Today"');
  });

  test('T-FE-S-03: Pinned row renders a Pin icon', () => {
    const pinnedChat = makeChat({ id: 1, title: 'My Pinned Chat', pinned: true });
    const html = renderToString(
      React.createElement(Sidebar, {
        models: [],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [pinnedChat],
        activeChatId: undefined,
        onSelectChat: () => {},
      }),
    );
    assert.ok(html.includes('lucide-pin') || html.includes('fill-current'));
    assert.ok(html.includes('My Pinned Chat'));
  });

  test('T-FE-S-04: initialRenamingId={id} renders input with defaultValue', () => {
    const chat = makeChat({ id: 42, title: 'Rename Me' });
    const html = renderToString(
      React.createElement(Sidebar, {
        models: [],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [chat],
        activeChatId: undefined,
        onSelectChat: () => {},
        onRename: () => {},
        initialRenamingId: 42,
      }),
    );
    assert.ok(html.includes('aria-label="Rename chat"'));
    assert.ok(html.includes('value="Rename Me"'));
  });

  test('T-FE-S-05: Render ConfirmDialog directly contains alertdialog role and buttons', () => {
    const html = renderToString(
      React.createElement(ConfirmDialog, {
        open: true,
        title: 'Delete chat?',
        message: 'Are you sure you want to delete this chat?',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    assert.ok(html.includes('role="alertdialog"'));
    assert.ok(html.includes('Delete chat?'));
    assert.ok(html.includes('Are you sure you want to delete this chat?'));
    assert.ok(html.includes('Cancel'));
    assert.ok(html.includes('Delete'));
  });

  test('T-FE-S-06: Sidebar with chats=[] renders "No chats yet." and no kebab button', () => {
    const html = renderToString(
      React.createElement(Sidebar, {
        models: [],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [],
        activeChatId: undefined,
        onSelectChat: () => {},
        onRename: () => {},
      }),
    );
    assert.ok(html.includes('No chats yet.'));
    assert.strictEqual(html.includes('aria-label="Chat actions"'), false);
  });

  test('T-FE-S-07: Regression — Sidebar with providers renders provider info and ModelPicker', () => {
    const groqProvider: ProviderPublic = {
      id: 'prov-groq',
      type: 'openai',
      label: 'Groq Cloud',
      baseUrl: 'https://api.groq.com/openai/v1',
      hasKey: true,
      defaultModel: 'llama-3.3-70b-versatile',
      enabled: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    const html = renderToString(
      React.createElement(Sidebar, {
        models: [{ name: 'llama3.2', size: 1000, modified_at: '2026-01-01' }],
        model: 'llama3.2',
        onModelChange: () => {},
        onNewChat: () => {},
        baseUrl: 'http://localhost:11434',
        status: 'online',
        loadingModels: false,
        onOpenSettings: () => {},
        onRetry: () => {},
        chats: [],
        activeChatId: undefined,
        onSelectChat: () => {},
        providers: [groqProvider],
        currentProviderId: groqProvider.id,
      }),
    );

    assert.ok(html.includes('Provider'));
    assert.ok(html.includes('Groq Cloud'));
  });
});
