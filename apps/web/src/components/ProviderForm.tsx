// Single responsibility: Form component for creating and editing AI provider configurations.

import { useState, useEffect } from 'react';
import {
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  KeyRound,
  Link2,
  Cpu,
  Layers,
} from 'lucide-react';
import type {
  ProviderPublic,
  ProviderCreateInput,
  ProviderType,
  ProviderTestResult,
} from '../types/providers';
import { testProvider, getProviderPresets } from '../lib/providers';

export interface ProviderFormProps {
  mode: 'create' | 'edit';
  initial?: ProviderPublic;
  onSave: (input: ProviderCreateInput & { enabled?: boolean; apiKey?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

const FALLBACK_PRESETS: Record<
  string,
  { label: string; baseUrl: string; type: ProviderType; defaultModel?: string }
> = {
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    type: 'openai',
    defaultModel: 'llama-3.1-70b-versatile',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    type: 'openai',
    defaultModel: 'gpt-4o',
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    type: 'openai',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    type: 'openai',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    type: 'openai',
    defaultModel: 'deepseek-chat',
  },
  mistral: {
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    type: 'openai',
    defaultModel: 'mistral-large-latest',
  },
};

export function ProviderForm({
  mode,
  initial,
  onSave,
  onDelete,
  onCancel,
}: ProviderFormProps) {
  const [type, setType] = useState<ProviderType>(initial?.type ?? 'openai');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState(initial?.defaultModel ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [testState, setTestState] = useState<
    | { kind: 'idle' }
    | { kind: 'testing' }
    | { kind: 'result'; result: ProviderTestResult }
  >({ kind: 'idle' });

  const [presets, setPresets] = useState<Record<string, any>>(FALLBACK_PRESETS);

  useEffect(() => {
    getProviderPresets()
      .then((p) => {
        if (p && Object.keys(p).length > 0) {
          setPresets(p);
        }
      })
      .catch(() => {
        // Fallback already populated
      });
  }, []);

  const handleApplyPreset = (key: string) => {
    const preset = presets[key];
    if (!preset) return;
    setLabel(preset.label || '');
    setBaseUrl(preset.baseUrl || '');
    setType((preset.type as ProviderType) || 'openai');
    if (preset.defaultModel) {
      setDefaultModel(preset.defaultModel);
    }
    setFormError(null);
  };

  const handleTest = async () => {
    if (!initial?.id) return;
    setTestState({ kind: 'testing' });
    try {
      const res = await testProvider(initial.id);
      setTestState({ kind: 'result', result: res });
    } catch (err) {
      setTestState({
        kind: 'result',
        result: { ok: false, error: (err as Error).message },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedLabel = label.trim();
    const trimmedUrl = baseUrl.trim();
    if (!trimmedLabel) {
      setFormError('Provider label is required.');
      return;
    }
    if (!trimmedUrl) {
      setFormError('Base URL is required.');
      return;
    }
    if (mode === 'create' && type !== 'ollama' && !apiKey.trim()) {
      setFormError('API Key is required for cloud providers.');
      return;
    }

    setSaving(true);
    try {
      const payload: ProviderCreateInput & { enabled?: boolean } = {
        type,
        label: trimmedLabel,
        baseUrl: trimmedUrl,
        defaultModel: defaultModel.trim() || undefined,
        enabled,
      };

      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      await onSave(payload);
    } catch (err) {
      setFormError((err as Error).message || 'Failed to save provider');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm(`Are you sure you want to delete "${label || 'this provider'}"?`)) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setFormError((err as Error).message || 'Failed to delete provider');
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header bar inside form */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {mode === 'create' ? 'Add New Provider' : `Edit ${initial?.label || 'Provider'}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>

      {formError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Preset buttons */}
      {mode === 'create' && (
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            <Layers size={13} className="text-gray-400" />
            Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(presets).map(([k, p]) => (
              <button
                key={k}
                type="button"
                onClick={() => handleApplyPreset(k)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Grid */}
      <div className="space-y-4">
        {/* Type & Label */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProviderType)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
            >
              <option value="openai">OpenAI compatible</option>
              <option value="ollama">Ollama</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              <Cpu size={12} className="text-gray-400" />
              Provider Name / Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Groq — Fast Llama"
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
            />
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
            <Link2 size={12} className="text-gray-400" />
            Base URL
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.groq.com/openai/v1"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
            <KeyRound size={12} className="text-gray-400" />
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              mode === 'edit' && initial?.hasKey
                ? '•••••••• (leave blank to keep existing key)'
                : 'Paste API Key (gsk_..., sk-..., etc.)'
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
          />
          {mode === 'edit' && initial?.hasKey && (
            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              ✓ Encrypted key configured. Enter a new key above only if replacing it.
            </p>
          )}
        </div>

        {/* Default Model */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Default Model (Optional)
          </label>
          <input
            type="text"
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="e.g. llama-3.1-70b-versatile or gpt-4o"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="provider-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-700 dark:bg-gray-800"
          />
          <label
            htmlFor="provider-enabled"
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Enable this provider
          </label>
        </div>
      </div>

      {/* Test Result Pill (if test was triggered) */}
      {testState.kind !== 'idle' && (
        <div className="rounded-lg border p-3 text-xs">
          {testState.kind === 'testing' && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={13} className="animate-spin" />
              <span>Testing connection…</span>
            </div>
          )}
          {testState.kind === 'result' && (
            <div>
              {testState.result.ok ? (
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check size={14} className="shrink-0" />
                  <span>
                    Connection verified! Latency: {testState.result.latencyMs}ms ·{' '}
                    {testState.result.modelCount} models reported
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Test failed: {testState.result.error || 'Unknown error'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions footer */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-800">
        <div className="flex gap-2">
          {mode === 'edit' && initial?.id && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testState.kind === 'testing'}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Test connection
            </button>
          )}
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {mode === 'create' ? 'Create Provider' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
