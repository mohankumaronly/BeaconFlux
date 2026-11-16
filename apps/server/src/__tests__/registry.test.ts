// Single responsibility: Unit tests for Provider Registry instantiation and lookup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { getProviderById } from '../providers/registry.js';
import { encrypt } from '../lib/crypto.js';
import type { ProviderRow } from '../db/schema.js';

test('T-UT-18: registry.getProviderById on enabled=false returns null', async () => {
  const mockGetProvider = async (id: string): Promise<ProviderRow | undefined> => {
    if (id === 'disabled-prov') {
      return {
        id: 'disabled-prov',
        type: 'openai',
        label: 'Disabled Provider',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnc: encrypt('test-key'),
        defaultModel: 'gpt-4o',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return undefined;
  };

  const provider = await getProviderById('disabled-prov', mockGetProvider);
  assert.strictEqual(provider, null);

  const nonExistent = await getProviderById('non-existent', mockGetProvider);
  assert.strictEqual(nonExistent, null);
});
