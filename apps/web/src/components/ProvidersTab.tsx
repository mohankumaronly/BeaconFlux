// Single responsibility: Settings tab component listing and managing AI providers.

import { useState } from 'react';
import { Plus, Cpu, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { useProviders } from '../contexts/ProvidersContext';
import { ProviderForm } from './ProviderForm';
import { createProvider, updateProvider, deleteProvider } from '../lib/providers';
import type { ProviderPublic, ProviderCreateInput } from '../types/providers';

export function ProvidersTab() {
  const { providers, loading, available, error, refresh } = useProviders();
  const [editing, setEditing] = useState<ProviderPublic | 'new' | null>(null);

  if (available === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-semibold">Provider API Unavailable</p>
        <p className="mt-1">
          Provider management requires backend 2.1+. Existing Ollama chats continue to work normally.
        </p>
      </div>
    );
  }

  if (loading && providers.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
        Loading providers…
      </div>
    );
  }

  if (error && !editing) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (editing) {
    return (
      <ProviderForm
        mode={editing === 'new' ? 'create' : 'edit'}
        initial={editing === 'new' ? undefined : editing}
        onSave={async (input: ProviderCreateInput & { enabled?: boolean }) => {
          if (editing === 'new') {
            await createProvider(input);
          } else {
            await updateProvider(editing.id, input);
          }
          await refresh();
          setEditing(null);
        }}
        onDelete={
          editing !== 'new'
            ? async () => {
                await deleteProvider(editing.id);
                await refresh();
                setEditing(null);
              }
            : undefined
        }
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Configured Providers
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use OpenAI-compatible providers alongside local Ollama
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <Plus size={14} /> Add provider
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-800">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <Cpu size={20} />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            No cloud providers added yet
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Connect Groq, Together AI, OpenRouter, DeepSeek, or LM Studio to chat with external models.
          </p>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
          >
            <Plus size={14} /> Add your first provider
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-gray-700 dark:hover:bg-gray-800"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {p.label}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {p.type}
                  </span>
                  {p.enabled ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <XCircle size={12} /> Disabled
                    </span>
                  )}
                </div>
                <p className="truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  {p.baseUrl}
                </p>
                {p.defaultModel && (
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    Default model: <span className="font-mono text-gray-600 dark:text-gray-300">{p.defaultModel}</span>
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
