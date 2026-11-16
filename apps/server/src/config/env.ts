// Single responsibility: Validate and export environment configuration.

import { z } from 'zod';
import { resolveApiToken } from '../lib/token.js';

const resolved = resolveApiToken();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  PUBLIC_URL: z.string().url().default('http://localhost:8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_TOKEN: z.string().min(1, 'API_TOKEN must not be empty'),
  API_TOKEN_FORCE_DISPLAY: z.enum(['true', 'false']).default('false'),
  SEARXNG_URL: z.string().url().default('http://searxng:8080'),
  // Comma-separated hostname patterns the backend is allowed to call for Ollama.
  // Wildcards: *.trycloudflare.com matches any subdomain.
  OLLAMA_ALLOWED_HOSTS: z
    .string()
    .default('*.trycloudflare.com,localhost,127.0.0.1,host.docker.internal')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  // Comma-separated hostname patterns the backend is allowed to call for custom/OpenAI providers.
  PROVIDER_ALLOWED_HOSTS: z
    .string()
    .default('*.trycloudflare.com,localhost,127.0.0.1,host.docker.internal')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ENCRYPTION_KEY: z.string().optional(),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
  API_TOKEN: resolved.token,
});

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  API_TOKEN_SOURCE: resolved.source,
  API_TOKEN_PATH: resolved.path,
};
