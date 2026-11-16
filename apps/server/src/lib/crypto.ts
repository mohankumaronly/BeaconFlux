// Single responsibility: AES-256-GCM encryption and decryption for sensitive data at rest.

import crypto from 'node:crypto';
import { env } from '../config/env.js';

let warnedKeyFallback = false;

function getDerivedKey(): Buffer {
  const customKey = env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (customKey && customKey.trim().length > 0) {
    return crypto.createHash('sha256').update(customKey).digest();
  }
  if (!warnedKeyFallback) {
    warnedKeyFallback = true;
    console.warn(
      '[crypto] ENCRYPTION_KEY is not set; falling back to API_TOKEN. Key rotation will invalidate stored provider API keys.',
    );
  }
  return crypto.createHash('sha256').update(env.API_TOKEN).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Payload format: base64(iv).base64(tag).base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a payload string previously encrypted with encrypt().
 * Throws if the payload is tampered with, invalid format, or cannot be authenticated.
 */
export function decrypt(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const ivB64 = parts[0];
  const tagB64 = parts[1];
  const cipherB64 = parts[2];

  if (!ivB64 || !tagB64 || !cipherB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Invalid IV or auth tag length in encrypted payload');
  }

  const key = getDerivedKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
