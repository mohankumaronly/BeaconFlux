/**
 * @file ModelPicker.tsx
 * @description Two-level provider and model selector component with fallback to a single dropdown.
 * Handles state synchronization between custom LLM providers and model choices, preventing
 * state desynchronization and invalid empty model payloads.
 */

import { useEffect } from 'react';
import { useModels } from '../hooks/useModels';
import type { ProviderPublic } from '../types/providers';
import type { OllamaModel } from '../types';

export interface ModelPickerProps {
  /** Optional array of configured custom/cloud providers. */
  providers?: ProviderPublic[];
  /** Active provider ID, or empty/undefined for local Ollama. */
  currentProviderId?: string;
  /** Currently selected model name or ID. */
  currentModel: string;
  /** Available models reported by local Ollama. */
  ollamaModels?: OllamaModel[];
  /** Callback fired when a provider or model is selected: (providerId, model) => void. */
  onSelect: (providerId: string, model: string) => void;
}

/**
 * ModelPicker component.
 * Renders either a two-level dropdown (Provider + Model) if custom providers exist,
 * or a single Ollama model dropdown when no providers are configured.
 *
 * @param props - Component props containing providers, models, selection state, and callback.
 * @returns React component representing the model selection UI.
 */
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
  // This prevents desync where currentModel does not exist on the selected provider.
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
              // Switching back to Ollama (local): clear provider ID and select the first Ollama model.
              const firstOllamaModel = ollamaModels.length > 0 ? ollamaModels[0].name : currentModel;
              onSelect('', firstOllamaModel);
            } else {
              const p = providers.find((x) => x.id === val);
              // If p.defaultModel is empty, do NOT send an empty string as the model.
              // Fall back to currentModel so a valid model string is always preserved.
              const modelToSelect = p?.defaultModel ? p.defaultModel : currentModel;
              onSelect(val, modelToSelect);
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
            value={currentModel}
            onChange={(e) => onSelect(currentProviderId, e.target.value)}
            disabled={loading && models.length === 0}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
          >
            {loading && models.length === 0 && <option value="">Loading models…</option>}
            {!loading && models.length === 0 && (
              <option value={currentModel}>{currentModel || '— no models —'}</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
            {currentModel && !models.some((m) => m.id === currentModel) && models.length > 0 && (
              <option value={currentModel}>{currentModel}</option>
            )}
          </select>
        ) : (
          <select
            value={currentModel}
            onChange={(e) => onSelect('', e.target.value)}
            disabled={ollamaModels.length === 0}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-900 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
          >
            {ollamaModels.length === 0 && <option value={currentModel}>{currentModel || '— no models —'}</option>}
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
