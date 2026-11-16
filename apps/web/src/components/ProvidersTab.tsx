// Single responsibility: Settings tab component listing and managing AI providers.

import { useProviders } from '../contexts/ProvidersContext';

export function ProvidersTab() {
  const { providers, loading, available, error } = useProviders();

  if (available === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        Provider management requires backend 2.1+.
      </div>
    );
  }

  if (loading) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Loading providers…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {providers.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No cloud providers configured yet.
        </p>
      ) : (
        providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-800/60"
          >
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{p.label}</p>
              <p className="font-mono text-[11px] text-gray-500">{p.baseUrl}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {p.type}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
