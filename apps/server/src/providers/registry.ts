// Single responsibility: Provider registry for looking up and instantiating providers by ID.

import type { Provider } from './base.provider.js';
import { makeOllamaProvider } from './ollama.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import * as repo from '../modules/providers/providers.repo.js';
import { decrypt } from '../lib/crypto.js';

export { makeOllamaProvider };

export async function getProviderById(
  id: string,
  getProvider = repo.getProvider,
): Promise<Provider | null> {
  const row = await getProvider(id);
  if (!row || !row.enabled) {
    return null;
  }

  if (row.type === 'ollama') {
    return makeOllamaProvider(row.baseUrl, row.id);
  }

  let apiKey: string | null = null;
  if (row.apiKeyEnc) {
    try {
      apiKey = decrypt(row.apiKeyEnc);
    } catch {
      apiKey = null;
    }
  }

  return new OpenAIProvider({
    id: row.id,
    baseUrl: row.baseUrl,
    apiKey,
    type: row.type as 'openai' | 'custom',
  });
}
