// Single responsibility: Type definitions for frontend provider management and models.

import type { ProviderPublic as SharedProviderPublic } from '@local-ollama/shared';

export type ProviderType = 'ollama' | 'openai' | 'custom';
export type ProviderPublic = SharedProviderPublic;

export interface ProviderCreateInput {
  type: ProviderType;
  label: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
}

export interface ProviderUpdateInput extends Partial<ProviderCreateInput> {
  enabled?: boolean;
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs?: number;
  modelCount?: number;
  error?: string;
}

export interface ProviderModel {
  id: string;
  name: string;
}
