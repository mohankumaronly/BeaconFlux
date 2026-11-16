// Single responsibility: Compact status badge displaying current provider and model name.

import type { ProviderPublic } from '../types/providers';

export function ProviderBadge({
  provider,
  model,
}: {
  provider?: ProviderPublic;
  model: string;
}) {
  if (!provider) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      <span className="font-semibold">{provider.label}</span>
      <span className="opacity-60">·</span>
      <span className="font-mono text-[11px]">{model}</span>
    </span>
  );
}
