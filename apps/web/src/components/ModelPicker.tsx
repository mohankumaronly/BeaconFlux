// Single responsibility: Two-level provider and model selector with fallback to single dropdown.

import { useEffect } from 'react';
import { useModels } from '../hooks/useModels';
import type { ProviderPublic } from '../types/providers';
import type { OllamaModel } from '../types';

export interface ModelPickerProps {
  providers?: ProviderPublic[];
  currentProviderId?: string;
  currentModel: string;
  ollamaModels?: OllamaModel[];
  onSelect: (providerId: string, model: string) => void;
}

export function ModelPicker({
  providers = [],
  currentProviderId,
  currentModel,
  ollamaModels = [],
  onSelect,
}: ModelPickerProps) {
  const { models, loading } = useModels(currentProviderId);

  // Snap to a valid model whenever the provider changes (or its model list
  // finishes loading) and the current model isn't in that provider's list.
  // This is what prevents "the model doesn't change when I switch provider".
  useEffect(() => {
    if (!currentProviderId) return;
    if (loading) return;
    if (models.length === 0) return;
    if (models.some((m) => m.id === currentModel)) return;

    const provider = providers.find((p) => p.id === currentProviderId);
    const fallback =
      provider?.defaultModel && models.some((m) => m.id === provider.defaultModel)
        ? provider.defaultModel
        : models[0].id;

    if (fallback && fallback !== currentModel) {
      onSelect(currentProviderId, fallback);
    }
  }, [currentProviderId, loading, models, currentModel, providers, onSelect]);

  // G16: If no providers configured or available, render legacy single Ollama dropdown
  if (!providers || providers.length === 0) {
    return (
      <div>
        <label className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Model
        </label>
        <select
          value={currentModel}
          onChange={(e) => onSelect('', e.target.value)}
          disabled={ollamaModels.length === 0}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
        >
          {ollamaModels.length === 0 && <option value={currentModel}>— no models —</option>}
          {ollamaModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Compute a safe controlled value for the model <select>: only use
  // currentModel if it actually exists in the current provider's list.
  const modelValue =
    currentProviderId && models.some((m) => m.id === currentModel) ? currentModel : '';
  const providerModelValue =
    !currentProviderId && ollamaModels.some((m) => m.name === currentModel)
      ? currentModel
      : !currentProviderId
        ? currentModel
        : '';

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Provider
        </label>
        <select
          value={currentProviderId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              // Switching back to Ollama (local). Parent keeps its own
              // per-provider model; pass the current one through so the
              // parent can decide whether to keep or replace it.
              onSelect('', currentModel);
            } else {
              const p = providers.find((x) => x.id === val);
              // Parent is responsible for preferring its cached model for
              // this provider; we only suggest defaultModel when it has none.
              onSelect(val, p?.defaultModel ?? '');
            }
          }}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
        >
          <option value="">Ollama (Local)</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Model
        </label>
        {currentProviderId ? (
          <select
            value={modelValue}
            onChange={(e) => onSelect(currentProviderId, e.target.value)}
            disabled={loading && models.length === 0}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
          >
            {loading && models.length === 0 && <option value="">Loading models…</option>}
            {!loading && models.length === 0 && <option value="">— no models —</option>}
            {!loading &&
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
          </select>
        ) : (
          <select
            value={providerModelValue}
            onChange={(e) => onSelect('', e.target.value)}
            disabled={ollamaModels.length === 0}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
          >
            {ollamaModels.length === 0 && <option value={currentModel}>— no models —</option>}
            {ollamaModels.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}