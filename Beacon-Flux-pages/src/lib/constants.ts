export const SITE = {
  name: 'BeaconFlux',
  tagline: 'Your private ChatGPT, on your own hardware.',
  description:
    'A self-hosted chat interface for local Ollama models — with Postgres persistence, SSE streaming, encrypted provider keys, and optional web search. One Docker command. Zero cloud.',
  github: 'https://github.com/mohankumaronly/BeaconFlux',
  dockerHub: 'https://hub.docker.com/r/mohan/beaconflux', // ← update with your username
  image: 'mohan/beaconflux:latest',                       // ← update
  version: '1.0.0',
  license: 'MIT',
} as const;

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Quick Start', href: '#quick-start' },
  { label: 'Providers', href: '#providers' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const DOCKER_RUN_CMD = `docker run -d --name beaconflux \\
  -p 8080:8080 \\
  -v beaconflux-data:/app/data \\
  ${SITE.image}`;

export const DOCKER_COMPOSE_CMD = `git clone ${SITE.github}.git
cd BeaconFlux/docker
docker compose up -d
docker compose logs -f server`;

// ---------- Hero copy ----------
export const HERO = {
  eyebrow: 'Self-hosted · Ollama-native',
  headline: 'Your private ChatGPT,',
  headlineAccent: 'on your own hardware.',
  subhead:
    'BeaconFlux is a self-hosted chat interface for local Ollama models — Postgres persistence, SSE streaming, encrypted provider keys, and optional web search. One Docker command. Zero cloud.',
  primaryCta: 'Copy install command',
  secondaryCta: 'View on GitHub',
} as const;

// ---------- Trust strip ----------
export const TRUST_ITEMS = [
  '100% local inference',
  'Postgres persistence',
  'Bearer-token auth',
  'AES-256-GCM provider keys',
  'Auto-migrations',
  'SSRF-hardened',
] as const;

// ---------- Quick start tabs ----------
export const QUICKSTART_TABS = [
  {
    id: 'docker',
    label: 'Docker',
    description:
      'One command. The container auto-runs migrations, generates a 256-bit API token on first boot, and prints it in the logs.',
    code: DOCKER_RUN_CMD,
    next: [
      'Open http://localhost:8080',
      'Copy the API token from docker logs beaconflux',
      'Paste it into the first-run modal → Test & Save',
    ],
  },
  {
    id: 'compose',
    label: 'Docker Compose',
    description:
      'Recommended for production. Brings up db + server + web + optional SearXNG with named volumes.',
    code: DOCKER_COMPOSE_CMD,
    next: [
      'Open http://localhost:8080',
      'Watch docker compose logs -f server for the startup banner',
      'Configure Ollama URL in Settings',
    ],
  },
  {
    id: 'dev',
    label: 'Dev mode',
    description:
      'Hot-reload across native frontend and backend. Requires an explicit API_TOKEN in apps/server/.env — no auto-generation.',
    code: `# Terminal 1 — Postgres
cd docker && docker compose up -d db

# Terminal 2 — backend
npm run dev:server

# Terminal 3 — frontend
npm run dev:web`,
    next: ['Open http://localhost:5173', 'Set API_TOKEN in apps/server/.env first'],
  },
  {
    id: 'tunnel',
    label: 'Cloudflare Tunnel',
    description:
      'Expose the app over HTTPS without opening ports. Always point the tunnel at :8080 (nginx), never :3000.',
    code: `cloudflared tunnel --url http://localhost:8080

# Then set in docker/.env:
# PUBLIC_URL=https://your-tunnel.trycloudflare.com`,
    next: ['Copy the generated https://…trycloudflare.com URL', 'Restart the stack to see it in the banner'],
  },
] as const;

// ---------- Features ----------
export const FEATURES = [
  {
    icon: 'cpu',
    title: '100% local inference',
    body: 'Ollama runs on your host with direct GPU access. No prompts, completions, or embeddings ever leave your machine.',
  },
  {
    icon: 'database',
    title: 'Postgres persistence',
    body: 'Chats, messages, and pins live in PostgreSQL via Drizzle ORM. Survives restarts, exportable as Markdown or JSON.',
  },
  {
    icon: 'zap',
    title: 'SSE streaming',
    body: 'Token-by-token responses rendered progressively through nginx with server-sent events. No polling, no buffering.',
  },
  {
    icon: 'shield',
    title: 'Bearer-token auth',
    body: 'A 256-bit token is generated on first boot, persisted with 0600 perms, and required on every /api/* route.',
  },
  {
    icon: 'layers',
    title: 'Auto-migrations',
    body: 'The server container applies Drizzle migrations at boot and tracks them in drizzle.__drizzle_migrations.',
  },
  {
    icon: 'plug',
    title: 'OpenAI-compatible providers',
    body: 'Native Ollama plus Groq, Together, OpenRouter, DeepSeek, Mistral, LM Studio, and vLLM. Keys encrypted at rest.',
  },
  {
    icon: 'search',
    title: 'Optional web search',
    body: 'SearXNG injects up to 5 cited snippets into the latest turn. Fail-soft — unreachable search never breaks a chat.',
  },
  {
    icon: 'lock',
    title: 'SSRF-hardened',
    body: 'OLLAMA_ALLOWED_HOSTS blocks private IPs, metadata services, and unlisted domains. Path-locked to /api/chat and /api/tags.',
  },
] as const;

// ---------- Providers ----------
export const PROVIDERS = [
  { name: 'Ollama', note: 'Native · local' },
  { name: 'Groq', note: 'OpenAI-compatible' },
  { name: 'Together AI', note: 'OpenAI-compatible' },
  { name: 'OpenRouter', note: 'OpenAI-compatible' },
  { name: 'DeepSeek', note: 'OpenAI-compatible' },
  { name: 'Mistral', note: 'OpenAI-compatible' },
  { name: 'LM Studio', note: 'Local · OpenAI-compatible' },
  { name: 'vLLM', note: 'Self-hosted · OpenAI-compatible' },
] as const;

// ---------- Architecture flow ----------
export const ARCH_FLOW = [
  {
    title: 'Browser',
    sub: 'React SPA + localStorage token',
    detail: 'Sends Authorization: Bearer <token> on every request.',
  },
  {
    title: 'nginx :8080',
    sub: 'Static SPA + /api/* proxy',
    detail: 'SSE streaming enabled. Only exposed port — never :3000 or :11434.',
  },
  {
    title: 'Express :3000',
    sub: 'Auth · chat · providers · search',
    detail: 'Bearer-token gate, SSRF allowlist, encrypted provider keys.',
  },
  {
    title: 'Postgres + Ollama',
    sub: ':5432 · :11434',
    detail: 'Drizzle ORM for persistence. Ollama runs on the host for GPU.',
  },
] as const;

// ---------- FAQ ----------
export const FAQ_ITEMS = [
  {
    q: 'Do I need Ollama installed?',
    a: 'Yes. Ollama runs on the host machine (not inside Docker) so it can use your GPU and share model weights. The server container reaches it via host.docker.internal:11434.',
  },
  {
    q: 'Where are my chats stored?',
    a: 'In PostgreSQL, inside the local-ollama-pgdata Docker volume. Chats survive restarts and can be exported as Markdown or JSON from the sidebar.',
  },
  {
    q: 'Is it multi-user?',
    a: 'Not in v1. The API token is a shared secret — every browser that has it sees the same chat database. Per-user accounts are on the roadmap.',
  },
  {
    q: 'How do I get the API token?',
    a: 'It prints in the server logs on first boot: docker compose logs server | Select-String "API Token". You can also read it with docker compose exec server cat /app/data/api-token.',
  },
  {
    q: 'Can I use a remote Ollama?',
    a: 'Yes. Expose Ollama through a Cloudflare Tunnel and set the URL in Settings. The tunnel should point at your Ollama host — the app itself is served on :8080.',
  },
  {
    q: 'Does it phone home?',
    a: 'No. There is no telemetry. The only outbound calls are the ones you configure: your chosen Ollama endpoint, OpenAI-compatible providers you add, and (optionally) SearXNG.',
  },
  {
    q: 'How do I upgrade?',
    a: 'Pull the new image and recreate the container: docker compose pull && docker compose up -d. Migrations run automatically at boot.',
  },
] as const;

export const DEMO = {
  eyebrow: 'Live demo',
  title: 'Watch it work',
  description:
    'A real session: streaming responses from a local model, switching models, and editing a chat title — no cuts.',
  src: '/demo/beaconflux-demo.mp4',
  srcWebm: '/demo/beaconflux-demo.webm', // optional; set to '' to omit
} as const;