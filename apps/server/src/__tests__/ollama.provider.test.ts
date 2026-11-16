// Single responsibility: Unit tests for OllamaProvider adapter.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeOllamaProvider } from '../providers/ollama.provider.js';

test('T-UT-17: OllamaProvider.chatStream delegates to streamOllamaChat', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  try {
    globalThis.fetch = (async (_input: unknown, _init?: unknown) => {
      fetchCallCount++;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                message: { role: 'assistant', content: 'Hello from mock Ollama' },
                done: false,
              }) + '\n',
            ),
          );
          controller.enqueue(
            encoder.encode(JSON.stringify({ done: true }) + '\n'),
          );
          controller.close();
        },
      });

      return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
    }) as any;

    const provider = makeOllamaProvider('http://localhost:11434');
    const chunks = [];
    for await (const chunk of provider.chatStream({
      model: 'llama3.2',
      messages: [{ role: 'user', content: 'Hello' }],
    })) {
      chunks.push(chunk);
    }

    assert.strictEqual(fetchCallCount, 1);
    assert.deepStrictEqual(chunks, [
      { type: 'token', text: 'Hello from mock Ollama' },
      { type: 'done' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
