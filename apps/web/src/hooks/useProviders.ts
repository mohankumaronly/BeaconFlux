// Single responsibility: Hook for provider selection with localStorage persistence and list reconciliation.

import { useEffect, useState } from 'react';
import { useProviders as useProvidersCtx, LAST_PROVIDER_KEY } from '../contexts/ProvidersContext';
import type { ProviderPublic } from '../types/providers';

export function useProviderSelection() {
  const { providers, available, loading } = useProvidersCtx();
  const [currentId, setCurrentId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem(LAST_PROVIDER_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      if (currentId) {
        localStorage.setItem(LAST_PROVIDER_KEY, currentId);
      } else {
        localStorage.removeItem(LAST_PROVIDER_KEY);
      }
    } catch {
      // Ignore storage errors in private browsing
    }
  }, [currentId]);

  // Reconcile: if currentId no longer exists in list, clear it.
  useEffect(() => {
    if (currentId && providers.length > 0 && !providers.some((p) => p.id === currentId)) {
      setCurrentId(undefined);
    }
  }, [providers, currentId]);

  const current: ProviderPublic | undefined = providers.find((p) => p.id === currentId);
  return { currentId, current, setCurrentId, providers, available, loading };
}
