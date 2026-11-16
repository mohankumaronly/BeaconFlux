// Single responsibility: Unit tests for OpenAIProvider adapter and SSE stream processing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../providers/openai.provider.js';

function createMockSseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event + '\n\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

test('T-UT-11: OpenAIProvider.chatStream parses data: {...} token', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return createMockSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello world"}}]}',
        'data: [DONE]',
      ]);
    }) as any;

    const provider = new OpenAIProvider({
      id: 'test-openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });

    const chunks = [];
    for await (const chunk of provider.chatStream({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk);
    }

    assert.deepStrictEqual(chunks, [
      { type: 'token', text: 'Hello world' },
      { type: 'done' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-UT-12: OpenAIProvider.chatStream [DONE] sentinel yields done', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return createMockSseResponse(['data: [DONE]']);
    }) as any;

    const provider = new OpenAIProvider({
      id: 'test-openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });

    const chunks = [];
    for await (const chunk of provider.chatStream({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk);
    }

    assert.deepStrictEqual(chunks, [{ type: 'done' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-UT-13: OpenAIProvider accumulates partial tool_calls deltas into one chunk', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return createMockSseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"web_search","arguments":"{\\"que"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ry\\":\\"Node.js 22\\"}"}}]}}]}',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        'data: [DONE]',
      ]);
    }) as any;

    const provider = new OpenAIProvider({
      id: 'test-openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });

    const chunks = [];
    for await (const chunk of provider.chatStream({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Search' }],
    })) {
      chunks.push(chunk);
    }

    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0]!.type, 'tool_calls');
    if (chunks[0]!.type === 'tool_calls') {
      assert.strictEqual(chunks[0]!.toolCalls.length, 1);
      assert.strictEqual(chunks[0]!.toolCalls[0]!.id, 'call_abc');
      assert.strictEqual(chunks[0]!.toolCalls[0]!.function.name, 'web_search');
      assert.deepStrictEqual(chunks[0]!.toolCalls[0]!.function.arguments, {
        query: 'Node.js 22',
      });
    }
    assert.deepStrictEqual(chunks[1], { type: 'done' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-UT-14: OpenAIProvider parses arguments string -> object', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return createMockSseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","function":{"name":"web_search","arguments":"{\\"query\\":\\"latest release\\"}"}}]}}]}',
        'data: [DONE]',
      ]);
    }) as any;

    const provider = new OpenAIProvider({
      id: 'test-openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });

    for await (const chunk of provider.chatStream({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'What is latest release?' }],
    })) {
      if (chunk.type === 'tool_calls') {
        assert.strictEqual(typeof chunk.toolCalls[0]!.function.arguments, 'object');
        assert.strictEqual(
          (chunk.toolCalls[0]!.function.arguments as any).query,
          'latest release',
        );
        return;
      }
    }
    assert.fail('Expected tool_calls chunk');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-UT-15: OpenAIProvider converts role: tool with tool_call_id in request body', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;

  try {
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return createMockSseResponse([
        'data: {"choices":[{"delta":{"content":"Answer"}}]}',
        'data: [DONE]',
      ]);
    }) as any;

    const provider = new OpenAIProvider({
      id: 'test-openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });

    const messages = [
      { role: 'user' as const, content: 'Search query' },
      {
        role: 'assistant' as const,
        content: '',
        tool_calls: [
          {
            id: 'call_abc',
            function: { name: 'web_search', arguments: { query: 'test' } },
          },
        ],
      },
      {
        role: 'tool' as const,
        content: 'Result context',
        tool_call_id: 'call_abc',
      },
    ];

    for await (const _ of provider.chatStream({
      model: 'gpt-4o',
      messages,
    })) {
      // Consume stream
    }

    assert.ok(capturedBody);
    const toolMsg = capturedBody.messages.find((m: any) => m.role === 'tool');
    assert.ok(toolMsg);
    assert.strictEqual(toolMsg.tool_call_id, 'call_abc');
    assert.strictEqual(toolMsg.content, 'Result context');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('T-UT-16: OpenAIProvider aborts on signal -> throws AbortError', async () => {
  const provider = new OpenAIProvider({
    id: 'test-openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
  });

  const abort = new AbortController();
  abort.abort();

  await assert.rejects(
    async () => {
      for await (const _ of provider.chatStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        signal: abort.signal,
      })) {
        // Stream aborted immediately
      }
    },
    (err: Error) => {
      return err.name === 'AbortError';
    },
  );
});
