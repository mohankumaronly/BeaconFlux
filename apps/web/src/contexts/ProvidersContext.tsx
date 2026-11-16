// Single responsibility: React Context provider for global provider list state and refresh actions.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { listProviders, ProviderApiUnavailable, hasApiToken } from '../lib/providers';
import type { ProviderPublic } from '../types/providers';

interface Ctx {
  providers: ProviderPublic[];
  loading: boolean;
  available: boolean | null; // null = unknown, true = ok, false = 404 (G16)
  error: string | null;
  refresh: () => Promise<void>;
}

const ProvidersContext = createContext<Ctx | undefined>(undefined);
const LAST_PROVIDER_KEY = 'lastProviderId';

export function ProvidersProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<ProviderPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProviders();
      setProviders(list);
      setAvailable(true);
    } catch (e) {
      if (e instanceof ProviderApiUnavailable) {
        setAvailable(false);
        setProviders([]);
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasApiToken()) {
      void refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  return (
    <ProvidersContext.Provider
      value={useMemo(
        () => ({ providers, loading, available, error, refresh }),
        [providers, loading, available, error, refresh],
      )}
    >
      {children}
    </ProvidersContext.Provider>
  );
}

export function useProviders(): Ctx {
  const ctx = useContext(ProvidersContext);
  if (!ctx) throw new Error('useProviders must be used within ProvidersProvider');
  return ctx;
}

export { LAST_PROVIDER_KEY };
