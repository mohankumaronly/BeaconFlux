// Single responsibility: Unit tests for SSRF safe base URL validation.

import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { isAllowedProviderUrl } from '../providers/ssrf.js';

test('T-UT-04: ssrf rejects http://10.0.0.1/v1', async () => {
  const allowed = await isAllowedProviderUrl('http://10.0.0.1/v1', 'openai');
  assert.strictEqual(allowed, false);
});

test('T-UT-05: ssrf rejects http://169.254.169.254/v1', async () => {
  const allowed = await isAllowedProviderUrl('http://169.254.169.254/v1', 'openai');
  assert.strictEqual(allowed, false);
});

test('T-UT-06: ssrf rejects https://user:pass@host/v1', async () => {
  const allowed = await isAllowedProviderUrl('https://user:pass@host/v1', 'openai');
  assert.strictEqual(allowed, false);
});

test('T-UT-07: ssrf accepts https://api.openai.com/v1', async () => {
  const allowed = await isAllowedProviderUrl('https://api.openai.com/v1', 'openai');
  assert.strictEqual(allowed, true);
});

test('T-UT-08: ssrf accepts http://localhost:1234/v1 (loopback)', async () => {
  const allowed = await isAllowedProviderUrl('http://localhost:1234/v1', 'openai');
  assert.strictEqual(allowed, true);
});

test('T-UT-09: ssrf accepts *.trycloudflare.com host', async () => {
  const allowed = await isAllowedProviderUrl('https://test-subdomain.trycloudflare.com/v1', 'openai');
  assert.strictEqual(allowed, true);
});

test('T-UT-10: ssrf rejects DNS resolving to private IP (mock DNS)', async () => {
  const originalLookup = dns.promises.lookup;
  try {
    // Mock DNS lookup to return a private IP for an unknown host
    (dns.promises as any).lookup = async (hostname: string) => {
      if (hostname === 'malicious.private.internal') {
        return [{ address: '10.20.30.40', family: 4 }];
      }
      return originalLookup(hostname);
    };

    const allowed = await isAllowedProviderUrl('https://malicious.private.internal/v1', 'custom');
    assert.strictEqual(allowed, false);
  } finally {
    dns.promises.lookup = originalLookup;
  }
});
