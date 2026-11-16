// Single responsibility: Catalog of predefined provider configurations and endpoints.

export const PROVIDER_PRESETS = {
  ollama: { label: 'Ollama (local)', baseUrl: 'http://host.docker.internal:11434', type: 'ollama' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', type: 'openai' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', type: 'openai' },
  together: { label: 'Together AI', baseUrl: 'https://api.together.xyz/v1', type: 'openai' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', type: 'openai' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', type: 'openai' },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', type: 'openai' },
  fireworks: { label: 'Fireworks', baseUrl: 'https://api.fireworks.ai/inference/v1', type: 'openai' },
  lmstudio: { label: 'LM Studio', baseUrl: 'http://host.docker.internal:1234/v1', type: 'openai', keyless: true },
  vllm: { label: 'vLLM', baseUrl: 'http://host.docker.internal:8000/v1', type: 'openai' },
  custom: { label: 'Custom (OpenAI-compatible)', baseUrl: '', type: 'openai' },
} as const;
