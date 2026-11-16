// Single responsibility: Unit tests for encryption and decryption utility.

import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../lib/crypto.js';

test('T-UT-01: crypto.encrypt -> decrypt roundtrip recovers original string', () => {
  const secret = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
  const ciphertext = encrypt(secret);
  const decrypted = decrypt(ciphertext);
  assert.strictEqual(decrypted, secret);
});

test('T-UT-02: crypto.decrypt on tampered payload throws', () => {
  const secret = 'my-super-secret-api-key';
  const ciphertext = encrypt(secret);
  const parts = ciphertext.split('.');
  assert.strictEqual(parts.length, 3);

  const iv = parts[0]!;
  const tag = parts[1]!;
  const cipher = parts[2]!;

  // Tamper with ciphertext by altering the last character
  const tamperedCipher = cipher.slice(0, -1) + (cipher.endsWith('a') ? 'b' : 'a');
  const tamperedPayload = `${iv}.${tag}.${tamperedCipher}`;

  assert.throws(() => {
    decrypt(tamperedPayload);
  });
});

test('T-UT-03: crypto.encrypt produces distinct ciphertexts for same input (random IV)', () => {
  const secret = 'identical-secret';
  const c1 = encrypt(secret);
  const c2 = encrypt(secret);
  assert.notStrictEqual(c1, c2);
  assert.strictEqual(decrypt(c1), secret);
  assert.strictEqual(decrypt(c2), secret);
});
