// Single responsibility: Integration and unit tests for Chat CRUD endpoints (rename, delete, pin, export).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renameChatHandler,
  deleteChatHandler,
  pinChatHandler,
  exportChatHandler,
  listChatsHandler,
} from '../modules/chat/chat.controller.js';
import { chatRepo as repo } from '../modules/chat/chat.repo.js';
import type { Chat, Message } from '../db/schema.js';

let chatsMap: Map<number, Chat>;
let messagesMap: Map<number, Message[]>;
let deleteChatCallCount = 0;

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
  const headers: Record<string, string> = {};
  let sentBody: any = null;
  let ended = false;

  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    send(body?: any) {
      sentBody = body;
      responseData = body;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    end() {
      ended = true;
      return this;
    },
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers,
    getBody: () => sentBody,
    getEnded: () => ended,
  } as any;
}

function makeChat(overrides: Partial<Chat> & { id: number; title: string }): Chat {
  return {
    id: overrides.id,
    title: overrides.title,
    providerId: overrides.providerId ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    pinned: overrides.pinned ?? false,
    pinnedAt: overrides.pinnedAt ?? null,
  };
}

function makeMessage(
  overrides: Partial<Message> & {
    id: number;
    chatId: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
  },
): Message {
  return {
    id: overrides.id,
    chatId: overrides.chatId,
    role: overrides.role,
    content: overrides.content,
    providerId: overrides.providerId ?? null,
    model: overrides.model ?? null,
    meta: overrides.meta ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

test.before(() => {
  repo.getChat = async (id: number): Promise<Chat | undefined> => {
    return chatsMap.get(id);
  };

  repo.listMessages = async (chatId: number): Promise<Message[]> => {
    return messagesMap.get(chatId) || [];
  };

  repo.createChat = async (title: string): Promise<Chat> => {
    const id = chatsMap.size + 1;
    const chat = makeChat({ id, title });
    chatsMap.set(id, chat);
    return chat;
  };

  repo.renameChat = async (id: number, title: string): Promise<Chat | undefined> => {
    const existing = chatsMap.get(id);
    if (!existing) return undefined;
    const updated: Chat = {
      ...existing,
      title,
    };
    chatsMap.set(id, updated);
    return updated;
  };

  repo.deleteChat = async (id: number): Promise<boolean> => {
    deleteChatCallCount++;
    const existed = chatsMap.delete(id);
    if (existed) {
      messagesMap.delete(id);
    }
    return existed;
  };

  repo.setPinned = async (id: number, pinned: boolean): Promise<Chat | undefined> => {
    const existing = chatsMap.get(id);
    if (!existing) return undefined;
    const updated: Chat = {
      ...existing,
      pinned,
      pinnedAt: pinned ? new Date() : null,
    };
    chatsMap.set(id, updated);
    return updated;
  };

  repo.getChatWithMessages = async (
    id: number,
  ): Promise<{ chat: Chat; messages: Message[] } | undefined> => {
    const chat = chatsMap.get(id);
    if (!chat) return undefined;
    const msgs = messagesMap.get(id) || [];
    return { chat, messages: msgs };
  };

  repo.listChats = async (): Promise<Chat[]> => {
    return Array.from(chatsMap.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  };
});

test.beforeEach(() => {
  chatsMap = new Map();
  messagesMap = new Map();
  deleteChatCallCount = 0;
});

test('T-CRUD-01: renameChatHandler valid body -> 200, title updated in map, updatedAt UNCHANGED', async () => {
  const originalUpdatedAt = new Date('2026-01-01T12:00:00.000Z');
  const chat = makeChat({ id: 1, title: 'Old Title', updatedAt: originalUpdatedAt });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'PATCH',
    params: { id: '1' },
    body: { title: 'New Title' },
  });
  const res = createMockRes();

  await renameChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const data = res.getData();
  assert.strictEqual(data.title, 'New Title');
  assert.strictEqual(data.updatedAt.getTime(), originalUpdatedAt.getTime());

  const stored = chatsMap.get(1);
  assert.ok(stored);
  assert.strictEqual(stored.title, 'New Title');
  assert.strictEqual(stored.updatedAt.getTime(), originalUpdatedAt.getTime());
});

test('T-CRUD-02: renameChatHandler with { title: "   " } -> 400', async () => {
  const chat = makeChat({ id: 1, title: 'Old Title' });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'PATCH',
    params: { id: '1' },
    body: { title: '   ' },
  });
  const res = createMockRes();

  await renameChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 400);
  assert.strictEqual(chatsMap.get(1)?.title, 'Old Title');
});

test('T-CRUD-03: renameChatHandler with 121-char title -> 400', async () => {
  const chat = makeChat({ id: 1, title: 'Old Title' });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'PATCH',
    params: { id: '1' },
    body: { title: 'a'.repeat(121) },
  });
  const res = createMockRes();

  await renameChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 400);
  assert.strictEqual(chatsMap.get(1)?.title, 'Old Title');
});

test('T-CRUD-04: renameChatHandler missing id -> 404', async () => {
  const req = createMockReq({
    method: 'PATCH',
    params: { id: '999' },
    body: { title: 'New Title' },
  });
  const res = createMockRes();

  await renameChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 404);
  assert.deepStrictEqual(res.getData(), { error: 'Chat not found' });
});

test('T-CRUD-05: deleteChatHandler existing id -> 204; chat removed from map; repo.deleteChat called once; messages map also cleared', async () => {
  const chat = makeChat({ id: 1, title: 'Chat To Delete' });
  chatsMap.set(1, chat);
  messagesMap.set(1, [
    makeMessage({ id: 1, chatId: 1, role: 'user', content: 'hello' }),
  ]);

  const req = createMockReq({
    method: 'DELETE',
    params: { id: '1' },
  });
  const res = createMockRes();

  await deleteChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 204);
  assert.strictEqual(res.getEnded(), true);
  assert.strictEqual(chatsMap.has(1), false);
  assert.strictEqual(messagesMap.has(1), false);
  assert.strictEqual(deleteChatCallCount, 1);
});

test('T-CRUD-06: deleteChatHandler missing id -> 404', async () => {
  const req = createMockReq({
    method: 'DELETE',
    params: { id: '999' },
  });
  const res = createMockRes();

  await deleteChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 404);
  assert.deepStrictEqual(res.getData(), { error: 'Chat not found' });
});

test('T-CRUD-07: pinChatHandler { pinned: true } -> 200, pinned=true in map, pinnedAt non-null', async () => {
  const chat = makeChat({ id: 1, title: 'Chat', pinned: false, pinnedAt: null });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'PATCH',
    params: { id: '1' },
    body: { pinned: true },
  });
  const res = createMockRes();

  await pinChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const data = res.getData();
  assert.strictEqual(data.pinned, true);
  assert.ok(data.pinnedAt !== null);

  const stored = chatsMap.get(1);
  assert.ok(stored);
  assert.strictEqual(stored.pinned, true);
  assert.ok(stored.pinnedAt !== null);
});

test('T-CRUD-08: pinChatHandler { pinned: false } -> 200, pinned=false, pinnedAt null', async () => {
  const chat = makeChat({ id: 1, title: 'Chat', pinned: true, pinnedAt: new Date() });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'PATCH',
    params: { id: '1' },
    body: { pinned: false },
  });
  const res = createMockRes();

  await pinChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const data = res.getData();
  assert.strictEqual(data.pinned, false);
  assert.strictEqual(data.pinnedAt, null);

  const stored = chatsMap.get(1);
  assert.ok(stored);
  assert.strictEqual(stored.pinned, false);
  assert.strictEqual(stored.pinnedAt, null);
});

test('T-CRUD-09: listChatsHandler returns pinned chats first, then non-pinned sorted by updatedAt desc', async () => {
  const chat1 = makeChat({
    id: 1,
    title: 'Chat 1',
    pinned: false,
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
  const chat2 = makeChat({
    id: 2,
    title: 'Chat 2',
    pinned: true,
    pinnedAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  const chat3 = makeChat({
    id: 3,
    title: 'Chat 3',
    pinned: false,
    updatedAt: new Date('2026-01-03T00:00:00Z'),
  });

  chatsMap.set(1, chat1);
  chatsMap.set(2, chat2);
  chatsMap.set(3, chat3);

  const req = createMockReq({ method: 'GET' });
  const res = createMockRes();

  await listChatsHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const data = res.getData() as Chat[];
  assert.strictEqual(data.length, 3);
  // Chat 2 (pinned) must be first, then Chat 3 (newest updatedAt), then Chat 1 (older updatedAt)
  assert.strictEqual(data[0]?.id, 2);
  assert.strictEqual(data[1]?.id, 3);
  assert.strictEqual(data[2]?.id, 1);
});

test('T-CRUD-10: exportChatHandler ?format=md -> 200; Content-Type contains "text/markdown"; Content-Disposition contains "attachment"; Content-Disposition contains "chat-<id>-"; body starts with "# <title>"; body contains "## User" and "## Assistant"', async () => {
  const chat = makeChat({ id: 1, title: 'My Awesome Discussion' });
  chatsMap.set(1, chat);
  messagesMap.set(1, [
    makeMessage({ id: 1, chatId: 1, role: 'user', content: 'What is TypeScript?' }),
    makeMessage({
      id: 2,
      chatId: 1,
      role: 'assistant',
      content: 'TypeScript is a typed superset of JavaScript.',
    }),
  ]);

  const req = createMockReq({
    method: 'GET',
    params: { id: '1' },
    query: { format: 'md' },
  });
  const res = createMockRes();

  await exportChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const headers = res.getHeaders();
  assert.ok(headers['Content-Type']?.includes('text/markdown'));
  assert.ok(headers['Content-Disposition']?.includes('attachment'));
  assert.ok(headers['Content-Disposition']?.includes('chat-1-'));
  assert.strictEqual(headers['Cache-Control'], 'no-store');

  const body = res.getBody();
  assert.ok(typeof body === 'string');
  assert.ok(body.startsWith('# My Awesome Discussion'));
  assert.ok(body.includes('## User'));
  assert.ok(body.includes('What is TypeScript?'));
  assert.ok(body.includes('## Assistant'));
  assert.ok(body.includes('TypeScript is a typed superset of JavaScript.'));
});

test('T-CRUD-11: exportChatHandler ?format=json -> 200; Content-Type contains "application/json"; parsed body = { chat: {...pinned, pinnedAt...}, messages: [...] }', async () => {
  const chat = makeChat({
    id: 1,
    title: 'JSON Export Test',
    pinned: true,
    pinnedAt: new Date('2026-01-01T00:00:00Z'),
  });
  chatsMap.set(1, chat);
  messagesMap.set(1, [
    makeMessage({ id: 1, chatId: 1, role: 'user', content: 'Ping' }),
    makeMessage({ id: 2, chatId: 1, role: 'assistant', content: 'Pong' }),
  ]);

  const req = createMockReq({
    method: 'GET',
    params: { id: '1' },
    query: { format: 'json' },
  });
  const res = createMockRes();

  await exportChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 200);
  const headers = res.getHeaders();
  assert.ok(headers['Content-Type']?.includes('application/json'));
  assert.ok(headers['Content-Disposition']?.includes('attachment'));
  assert.ok(headers['Content-Disposition']?.includes('chat-1-'));

  const parsed = JSON.parse(res.getBody());
  assert.ok(parsed.chat);
  assert.strictEqual(parsed.chat.id, 1);
  assert.strictEqual(parsed.chat.pinned, true);
  assert.ok(parsed.chat.pinnedAt !== undefined);
  assert.ok(Array.isArray(parsed.messages));
  assert.strictEqual(parsed.messages.length, 2);
});

test('T-CRUD-12: exportChatHandler ?format=pdf -> 400', async () => {
  const chat = makeChat({ id: 1, title: 'Chat' });
  chatsMap.set(1, chat);

  const req = createMockReq({
    method: 'GET',
    params: { id: '1' },
    query: { format: 'pdf' },
  });
  const res = createMockRes();

  await exportChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 400);
  assert.strictEqual(res.getData().error, 'Invalid format');
});

test('T-CRUD-13: exportChatHandler missing id -> 404', async () => {
  const req = createMockReq({
    method: 'GET',
    params: { id: '999' },
    query: { format: 'md' },
  });
  const res = createMockRes();

  await exportChatHandler(req, res);

  assert.strictEqual(res.getStatus(), 404);
  assert.deepStrictEqual(res.getData(), { error: 'Chat not found' });
});
