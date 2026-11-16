// Single responsibility: Hook for per-provider model listing with 60s in-memory caching.

import { useEffect, useState } from 'react';
import { listProviderModels } from '../lib/providers';
import type { ProviderModel } from '../types/providers';

const cache = new Map<string, { at: number; models: ProviderModel[] }>();
const TTL = 60_000;

export function useModels(providerId: string | undefined) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) {
      setModels([]);
      setLoading(false);
      setError(null);
      return;
    }

    const hit = cache.get(providerId);
    if (hit && Date.now() - hit.at < TTL) {
      setModels(hit.models);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listProviderModels(providerId)
      .then((list) => {
        if (!cancelled) {
          cache.set(providerId, { at: Date.now(), models: list });
          setModels(list);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return { models, loading, error };
}
