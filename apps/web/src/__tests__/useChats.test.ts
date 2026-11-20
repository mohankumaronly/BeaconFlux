// Single responsibility: Unit tests for useChats hook logic, sorting rules, and streaming guard behavior.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sortChats, shouldBlockMutation } from '../hooks/useChats';
import type { ChatSummary } from '../lib/api';

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

describe('useChats hook logic Test Suite', () => {
  test('T-FE-H-01: sortChats([nonPinned(updatedAt newer), pinned(any)]) -> pinned first', () => {
    const newerNonPinned = makeChat({
      id: 1,
      title: 'Newer Unpinned',
      pinned: false,
      updatedAt: '2026-01-02T12:00:00.000Z',
    });
    const olderPinned = makeChat({
      id: 2,
      title: 'Older Pinned',
      pinned: true,
      pinnedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const sorted = sortChats([newerNonPinned, olderPinned]);
    assert.strictEqual(sorted.length, 2);
    assert.strictEqual(sorted[0]?.id, 2, 'Pinned chat must be placed first');
    assert.strictEqual(sorted[1]?.id, 1, 'Unpinned chat must be placed second');
  });

  test('T-FE-H-02: sortChats([]) -> []', () => {
    const sorted = sortChats([]);
    assert.deepStrictEqual(sorted, []);
  });

  test('T-FE-H-03: sortChats with 2 pinned + 1 non-pinned -> both pinned first, ordered by updatedAt DESC among pinned', () => {
    const pinnedOlder = makeChat({
      id: 1,
      title: 'Pinned Older',
      pinned: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const pinnedNewer = makeChat({
      id: 2,
      title: 'Pinned Newer',
      pinned: true,
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
    const unpinnedNewest = makeChat({
      id: 3,
      title: 'Unpinned Newest',
      pinned: false,
      updatedAt: '2026-01-05T00:00:00.000Z',
    });

    const sorted = sortChats([pinnedOlder, unpinnedNewest, pinnedNewer]);
    assert.strictEqual(sorted.length, 3);
    assert.strictEqual(sorted[0]?.id, 2, 'Pinned newer is first');
    assert.strictEqual(sorted[1]?.id, 1, 'Pinned older is second');
    assert.strictEqual(sorted[2]?.id, 3, 'Unpinned newest is third');
  });

  test('T-FE-H-04: shouldBlockMutation blocks actions when isStreaming is true and allows when false', () => {
    assert.strictEqual(shouldBlockMutation(true), true, 'Mutations must be blocked while streaming');
    assert.strictEqual(shouldBlockMutation(false), false, 'Mutations allowed when idle');
  });

  test('T-FE-H-05: sortChats stable for equal updatedAt (deterministic order)', () => {
    const chatA = makeChat({
      id: 1,
      title: 'Chat A',
      pinned: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const chatB = makeChat({
      id: 2,
      title: 'Chat B',
      pinned: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const run1 = sortChats([chatA, chatB]);
    const run2 = sortChats([chatA, chatB]);

    assert.strictEqual(run1[0]?.id, run2[0]?.id);
    assert.strictEqual(run1[1]?.id, run2[1]?.id);
  });
});
