// Single responsibility: Express request handlers for provider management APIs.

import type { Request, Response } from 'express';
import { z } from 'zod';
import * as repo from './providers.repo.js';
import { getProviderById } from '../../providers/registry.js';
import { isAllowedProviderUrl } from '../../providers/ssrf.js';
import { PROVIDER_PRESETS } from '../../providers/presets.js';
import { encrypt } from '../../lib/crypto.js';
import type { ProviderRow } from '../../db/schema.js';

function toProviderResponse(row: ProviderRow) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    baseUrl: row.baseUrl,
    hasKey: Boolean(row.apiKeyEnc),
    defaultModel: row.defaultModel ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const CreateProviderSchema = z.object({
  type: z.enum(['ollama', 'openai', 'custom']),
  label: z.string().min(1).max(64),
  baseUrl: z.string().url(),
  apiKey: z.string().optional().nullable(),
  defaultModel: z.string().max(128).optional().nullable(),
});

const UpdateProviderSchema = z.object({
  label: z.string().min(1).max(64).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().nullable().optional(),
  defaultModel: z.string().max(128).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function listProvidersHandler(_req: Request, res: Response): Promise<void> {
  const rows = await repo.listProviders();
  res.json(rows.map(toProviderResponse));
}

export async function createProviderHandler(req: Request, res: Response): Promise<void> {
  const parsed = CreateProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { type, label, baseUrl, apiKey, defaultModel } = parsed.data;

  const allowed = await isAllowedProviderUrl(baseUrl, type);
  if (!allowed) {
    res.status(400).json({ error: 'Invalid URL', details: 'URL not allowed by SSRF policy' });
    return;
  }

  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  const isKeylessPreset = Object.values(PROVIDER_PRESETS).some(
    (p) => 'keyless' in p && p.keyless && p.baseUrl.replace(/\/+$/, '') === normalizedUrl,
  );

  const hasApiKey = typeof apiKey === 'string' && apiKey.trim().length > 0;
  if (type !== 'ollama' && !isKeylessPreset && !hasApiKey) {
    res.status(400).json({
      error: 'Invalid body',
      details: 'apiKey is required for this provider type',
    });
    return;
  }

  const apiKeyEnc = hasApiKey ? encrypt(apiKey!.trim()) : null;

  const row = await repo.createProvider({
    type,
    label: label.trim(),
    baseUrl: normalizedUrl,
    apiKeyEnc,
    defaultModel: defaultModel?.trim() || null,
    enabled: true,
  });

  res.status(201).json(toProviderResponse(row));
}

export async function updateProviderHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Provider id required' });
    return;
  }

  const existing = await repo.getProvider(id);
  if (!existing) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  const parsed = UpdateProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { label, baseUrl, apiKey, defaultModel, enabled } = parsed.data;
  const updateData: Partial<typeof existing> = {};

  if (label !== undefined) updateData.label = label.trim();
  if (defaultModel !== undefined) updateData.defaultModel = defaultModel?.trim() || null;
  if (enabled !== undefined) updateData.enabled = enabled;

  if (baseUrl !== undefined) {
    const normalizedUrl = baseUrl.replace(/\/+$/, '');
    const allowed = await isAllowedProviderUrl(normalizedUrl, existing.type as any);
    if (!allowed) {
      res.status(400).json({ error: 'Invalid URL', details: 'URL not allowed by SSRF policy' });
      return;
    }
    updateData.baseUrl = normalizedUrl;
  }

  if (apiKey !== undefined) {
    if (apiKey === null || apiKey.trim() === '') {
      updateData.apiKeyEnc = null;
    } else {
      updateData.apiKeyEnc = encrypt(apiKey.trim());
    }
  }

  const updated = await repo.updateProvider(id, updateData);
  if (!updated) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  res.json(toProviderResponse(updated));
}

export async function deleteProviderHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Provider id required' });
    return;
  }

  await repo.deleteProvider(id);
  res.status(204).send();
}

export async function getProviderModelsHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Provider id required' });
    return;
  }

  const provider = await getProviderById(id);
  if (!provider) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  try {
    const modelNames = await provider.listModels();
    res.json({
      models: modelNames.map((name) => ({ id: name, name })),
    });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

export async function testProviderHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Provider id required' });
    return;
  }

  const provider = await getProviderById(id);
  if (!provider) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  const start = Date.now();
  try {
    const models = await provider.listModels();
    const latencyMs = Date.now() - start;
    res.json({ ok: true, latencyMs, modelCount: models.length });
  } catch (err) {
    // Deliver as HTTP 200 with ok: false per §9
    res.json({ ok: false, error: (err as Error).message });
  }
}

export function getPresetsHandler(_req: Request, res: Response): void {
  res.json(PROVIDER_PRESETS);
}
