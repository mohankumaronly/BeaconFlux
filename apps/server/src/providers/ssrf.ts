// Single responsibility: SSRF validation and safe URL checking for provider endpoints.

import dns from 'node:dns';
import { env } from '../config/env.js';
import { PROVIDER_PRESETS } from './presets.js';

function isHostAllowlisted(targetHost: string): boolean {
  return env.PROVIDER_ALLOWED_HOSTS.some((pattern) => {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      return targetHost.endsWith(suffix) && targetHost.length > suffix.length;
    }
    return targetHost === pattern;
  });
}

function isIpv4Literal(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

function isIpv6Literal(h: string): boolean {
  return h.startsWith('[') || (h.includes(':') && !h.includes('.'));
}

function cleanIp(ip: string): string {
  return ip.replace(/^\[|\]$/g, '').toLowerCase();
}

function isMetadataIp(ip: string): boolean {
  const clean = cleanIp(ip);
  if (clean === '169.254.169.254' || clean === 'fd00:ec2::254') return true;
  if (clean.startsWith('169.254.')) return true;
  if (clean.startsWith('fe80:')) return true;
  return false;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = cleanIp(ip);
  if (isMetadataIp(clean)) return true;
  if (clean === '127.0.0.1' || clean === '::1' || clean === '0.0.0.0') return true;
  if (clean.startsWith('127.')) return true;
  if (clean.startsWith('10.')) return true;
  if (clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
  return false;
}

/**
 * Returns true if the raw URL passes SSRF security checks.
 * Rejects private IPs, cloud metadata addresses, embedded credentials,
 * non-HTTPS schemes (unless loopback or allowlisted), and IP literals
 * unless explicitly allowed.
 */
export async function isAllowedProviderUrl(
  raw: string,
  _type: 'ollama' | 'openai' | 'custom',
): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }

  // Reject embedded credentials
  if (u.username || u.password) return false;

  // Only http: and https: protocols allowed
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  const host = u.hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  const allowlisted = isHostAllowlisted(host);

  // http: allowed ONLY if host is loopback or in PROVIDER_ALLOWED_HOSTS
  if (u.protocol === 'http:' && !isLoopback && !allowlisted) {
    return false;
  }

  // If baseUrl matches a known preset exactly, trust it (skip DNS)
  const normalizedRaw = raw.replace(/\/+$/, '');
  const isPreset = Object.values(PROVIDER_PRESETS).some(
    (preset) => preset.baseUrl && preset.baseUrl.replace(/\/+$/, '') === normalizedRaw,
  );
  if (isPreset) {
    return true;
  }

  const isIpLiteral = isIpv4Literal(host) || isIpv6Literal(host);
  if (isIpLiteral) {
    if (isMetadataIp(host)) return false;
    if (isLoopback) return true;
    if (allowlisted) {
      return true;
    }
    // Reject other IP literals unless 127.0.0.1, ::1, or explicitly in PROVIDER_ALLOWED_HOSTS
    return false;
  }

  // If host is explicitly allowlisted by name, trust it
  if (allowlisted) {
    return true;
  }

  // DNS lookup check for hostname: reject if any resolved IP is private or metadata
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    if (!addresses || addresses.length === 0) return false;
    for (const record of addresses) {
      if (isMetadataIp(record.address)) return false;
      if (isPrivateOrLocalIp(record.address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that the given provider base URL is safe. Throws if invalid or disallowed.
 */
export async function assertSafeBaseUrl(
  raw: string,
  type: 'ollama' | 'openai' | 'custom',
): Promise<void> {
  const allowed = await isAllowedProviderUrl(raw, type);
  if (!allowed) {
    throw new Error(
      `Provider base URL is not allowed by policy or allowlist: ${raw}`,
    );
  }
}
