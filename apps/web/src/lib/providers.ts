// Single responsibility: Client API for backend provider endpoints with G16 feature detection.

import { authHeaders, hasApiToken } from './api';
import type {
  ProviderPublic,
  ProviderCreateInput,
  ProviderUpdateInput,
  ProviderTestResult,
  ProviderModel,
} from '../types/providers';

const BASE = '/api/v1/providers';

// G16: feature detection — a single shared flag set on first 404.
let _providersAvailable: boolean | null = null;
export function providersAvailable(): boolean | null {
  return _providersAvailable;
}

export class ProviderApiUnavailable extends Error {
  constructor() {
    super('Provider API unavailable (backend < 2.1)');
    this.name = 'ProviderApiUnavailable';
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: authHeaders({
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    }),
  });

  if (res.status === 404 && path === '') {
    _providersAvailable = false;
    throw new ProviderApiUnavailable();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `providers ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export async function listProviders(): Promise<ProviderPublic[]> {
  const list = await req<ProviderPublic[]>('');
  _providersAvailable = true;
  return list;
}

export async function createProvider(input: ProviderCreateInput): Promise<ProviderPublic> {
  return req<ProviderPublic>('', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProvider(
  id: string,
  input: ProviderUpdateInput,
): Promise<ProviderPublic> {
  return req<ProviderPublic>(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProvider(id: string): Promise<void> {
  return req<void>(`/${id}`, {
    method: 'DELETE',
  });
}

export async function testProvider(id: string): Promise<ProviderTestResult> {
  return req<ProviderTestResult>(`/${id}/test`, {
    method: 'POST',
  });
}

export async function listProviderModels(id: string): Promise<ProviderModel[]> {
  const data = await req<{ models: { id: string; name?: string }[] }>(`/${id}/models`);
  return (data.models ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
}

export async function getProviderPresets(): Promise<
  Record<string, { label: string; baseUrl: string; type: string; keyless?: boolean }>
> {
  return req<Record<string, { label: string; baseUrl: string; type: string; keyless?: boolean }>>(
    '/presets',
  );
}

export { hasApiToken };
