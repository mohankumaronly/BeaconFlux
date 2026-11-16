// Single responsibility: Two-level provider and model selector with fallback to single dropdown.

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
              const firstOllama = ollamaModels[0]?.name ?? currentModel;
              onSelect('', firstOllama);
            } else {
              const p = providers.find((x) => x.id === val);
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
            {currentModel && !models.some((m) => m.id === currentModel) && (
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
