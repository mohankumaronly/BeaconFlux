# Beacon Flux (Local Ollama Chat Interface)

A persisted chat application using Ollama for local LLM inference, Express for the backend API, PostgreSQL for persistence, and React for the frontend. Works against local Ollama **or** a remote Ollama exposed through a Cloudflare Tunnel.

## Quick Start (production — the recommended path)

Open your terminal and run these three commands. No `.env` files, no manual token creation, and no manual database migrations are required.

```powershell
git clone https://github.com/mohankumaronly/BeaconFlux.git
cd BeaconFlux/docker
docker compose up -d

# Show the startup banner (URL + API Token)
docker compose logs -f server
```

On first boot, the server container automatically applies database migrations, generates a secure 256-bit API token, and prints a startup banner to the terminal logs:

```
                            🦙  L O C A L   O L L A M A
                        chat interface · self-hosted · private
                                      ✅  READY


          ╭──────────────────────────────────────────────────────────────╮
          │   🌐  ACCESS                                                 │
          │                                                              │
          │     Open in browser                                          │
          │     http://localhost:8080                                    │
          │                                                              │
          │     Ollama backend                                           │
          │     http://host.docker.internal:11434                        │
          ├──────────────────────────────────────────────────────────────┤
          │   🔑  API TOKEN                                              │
          │                                                              │
          │     <YOUR_API_TOKEN>                                         │
          │                                                              │
          │     👉 paste this into Settings on first load                │
          ├──────────────────────────────────────────────────────────────┤
          │   🛠   RECOVERY & ROTATION                                   │
          │                                                              │
          │     📄 Recover token                                         │
          │        docker compose exec server cat /app/data/api-token    │
          │                                                              │
          │     🔄 Rotate token                                          │
          │        docker volume rm local-ollama-api-token               │
          │        && docker compose up -d server                        │
          │                                                              │
          ╰──────────────────────────────────────────────────────────────╯


     💾 token persisted at /app/data/api-token · volume local-ollama-api-token
             press Ctrl+C to stop · logs: docker compose logs -f server

```

### What happens next

1. Open `http://localhost:8080` in your browser.
2. A first-run modal appears prompting for your API token. Copy the token from your terminal logs (`docker compose logs server | Select-String "API Token"`) and click **Test & Save**.
3. The modal verifies your token directly against the backend via `GET /api/v1/auth/verify`. Only upon a successful `200 OK` response is the token stored in `localStorage` under key `apiToken`.
4. If you click **Cancel**, the modal dismisses and an amber "no token configured" banner appears with an escape hatch to open Settings manually.
5. Configure your Ollama URL in Settings if remote, and start chatting!

---

## How it works (what just happened)

### Boot sequence

```
Docker Compose Up
  │
  ├── db service starts (PostgreSQL 16)
  │     └─ persists data in 'local-ollama-pgdata' volume (:5433 host / :5432 container)
  │
  ├── server service starts (entrypoint.sh)
  │     ├─ 1. Wait for DB ready & apply migrations (node dist/db/migrate.js)
  │     │     └─ tracks schema versions in drizzle.__drizzle_migrations
  │     ├─ 2. Resolve API_TOKEN priority chain:
  │     │     ├─ Priority 1: API_TOKEN env var (source: "env")
  │     │     ├─ Priority 2: API_TOKEN_FILE contents (source: "file")
  │     │     └─ Priority 3: Auto-generate new 256-bit token (source: "generated")
  │     ├─ 3. Persist generated token to /app/data/api-token in 'local-ollama-api-token' volume (chmod 0600)
  │     ├─ 4. Print startup banner with URL + token to stdout
  │     └─ 5. Start Express API server on :3000
  │
  └── web service starts (nginx:1.27)
        ├─ Serves built React SPA on :8080
        └─ Proxies /api/* requests to server:3000 (SSE streaming enabled)
```

- **Token resolution**: The server resolves the token using a strict priority chain: an explicit `API_TOKEN` environment variable wins; if unset, it reads the persisted file `/app/data/api-token`; if absent, it generates a fresh crypto-random token on first boot.
- **Migration tracking**: Migrations are executed at container boot using `drizzle-orm` and recorded in the database table `drizzle.__drizzle_migrations`.

---

## Dev mode (for contributors)

Dev mode provides hot-reloading across the native frontend and backend processes. Unlike production, dev mode requires explicit `API_TOKEN` in `apps/server/.env` and will fail loudly without it (no auto-generation by design).

```powershell
# Terminal 1 — Postgres in Docker
cd docker; docker compose up -d db

# Terminal 2 — backend
npm run dev:server

# Terminal 3 — frontend
npm run dev:web
```

Open `http://localhost:5173`. Both frontend and backend hot-reload on save. Vite proxies `/api/*` → `http://localhost:3000`.

### Generating an API token for dev mode (helper)

To generate a token for `apps/server/.env`:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').Replace('=','')
```

Place this value in `apps/server/.env` under `API_TOKEN=<token>`.

### Database migrations in dev mode

```powershell
# After editing apps/server/src/db/schema.ts:
npm run db:generate -w apps/server
npm run db:migrate -w apps/server
```

`apps/server/.env` uses `localhost:5433`; inside Docker, `server` uses `db:5432`.

---

## Configuration

All production settings are optional; defaults work out of the box without any `.env` file. You can create `docker/.env` to override defaults (see `docker/.env.example`).

| Variable | Where | Default | Purpose | Required? |
|---|---|---|---|---|
| `API_TOKEN` | `docker/.env`, `apps/server/.env` | *(auto-generated)* | Shared secret for backend API authentication. | Required in dev mode; optional in prod (auto-generated) |
| `API_TOKEN_FILE` | container / env | `/app/data/api-token` | Filesystem path where the API token is persisted. | Optional |
| `API_TOKEN_FORCE_DISPLAY` | `docker/.env` | `false` | When `true`, prints full token in banner on every boot instead of fingerprint. | Optional (local debugging only) |
| `MIGRATIONS_AUTO` | `docker/.env` | `true` | When `true`, container applies schema migrations on startup. | Optional |
| `PUBLIC_URL` | `docker/.env` | `http://localhost:8080` | URL surfaced in the startup banner (e.g. your Cloudflare Tunnel URL). | Optional |
| `OLLAMA_URL` | `apps/server/.env` | `http://localhost:11434` | Default Ollama endpoint used by backend if not client-provided. | Optional |
| `OLLAMA_ALLOWED_HOSTS` | `apps/server/.env` | `*.trycloudflare.com,localhost,127.0.0.1,host.docker.internal` | Comma-separated allowed hostnames/wildcards for SSRF protection. | Optional |
| `DATABASE_URL` | `apps/server/.env` | *(configured in compose)* | PostgreSQL connection string (`postgresql://user:pass@host:port/db`). | Required in dev mode (`localhost:5433`); set in compose for prod |
| `PORT` | `apps/server/.env` | `3000` | Port for Express backend API. | Optional |
| `NODE_ENV` | env | `development` / `production` | Node environment flag (`production`, `development`, `test`). | Optional |
| `POSTGRES_USER` | `docker/.env` | `ollama` | PostgreSQL database username. | Optional |
| `POSTGRES_PASSWORD` | `docker/.env` | `ollama_secret` | PostgreSQL database password. | Optional |
| `POSTGRES_DB` | `docker/.env` | `ollama_chat` | PostgreSQL database name. | Optional |
| `SEARXNG_URL` | `docker/.env`, `apps/server/.env` | `http://searxng:8080` | SearXNG backend URL for web search context injection. | Optional |
| `MIGRATIONS_FOLDER` | container / env | `./drizzle` | Directory path containing Drizzle SQL migration files. | Optional (internal default) |
| `MIGRATIONS_RETRY_MAX` | container / env | `30` | Maximum connection retry attempts before migration fails. | Optional (internal default) |

---

## Token lifecycle

### Where the token lives

- **On disk (production container)**: Stored at `/app/data/api-token` with strict `0600` POSIX permissions, persisted inside the Docker named volume `local-ollama-api-token`.
- **In browser**: Stored in the browser's `localStorage` under the key `apiToken`.
- **In dev mode**: Configured in `apps/server/.env` as `API_TOKEN=...`.

### How to recover a lost token

If you need to retrieve your token after first boot:

```powershell
docker compose exec server cat /app/data/api-token
```

Or view container logs:

```powershell
docker compose logs server | Select-String "API Token"
```

### How to rotate the token

To rotate the auto-generated token in production, remove the token volume and recreate the stack:

```powershell
cd docker
docker compose down
docker volume rm local-ollama-api-token
docker compose up -d
```

On subsequent page reloads, a background probe detects the token mismatch and shows a non-blocking toast notification informing the user that the token is invalid and can be updated in Settings without interrupting active chats.

Alternatively, you can provide an explicit `API_TOKEN=new-token` override in `docker/.env` and recreate the server container.

### API_TOKEN_FORCE_DISPLAY (local-only escape hatch)

For security, subsequent boots do not echo the full token in logs; they print a token fingerprint (first 8 hex characters of its sha256 hash):

```
API Token:        [persisted] sha256:7f3a8b1c...
```

To force printing the full token on every boot (useful during local development or headless deployments), set:

```env
API_TOKEN_FORCE_DISPLAY=true
```

in `docker/.env`.

### Source semantics: env / file / generated

- `source: "env"` — An explicit `API_TOKEN` environment variable was provided (dev mode, CI, or explicit `docker/.env` override). No file is written to disk.
- `source: "file"` — The token was loaded from `/app/data/api-token`, persisted from a previous boot.
- `source: "generated"` — A new cryptographically secure 256-bit token was generated on first boot and persisted to `/app/data/api-token`.

---

## Database migrations

### Auto-applied on container boot

In production, database migrations run automatically on container boot via `entrypoint.sh` calling `node dist/db/migrate.js` before starting the HTTP server.
This behavior is controlled by the `MIGRATIONS_AUTO` environment variable (defaults to `true`). If migration fails (e.g., database unreachable after retries), the container exits immediately (fail-closed) to prevent starting an API against an invalid schema.

### Generating new migrations (host, dev-time)

When modifying `apps/server/src/db/schema.ts`, generate new SQL migrations on the host:

```powershell
npm run db:generate -w apps/server
```

### Interchangeability with host db:migrate

Both container auto-migration and host-side `npm run db:migrate -w apps/server` execute against PostgreSQL and record applied migrations in the shared table `drizzle.__drizzle_migrations`. They are byte-interchangeable; a migration applied on the host will not re-run in the container, and vice versa.

### Data reset

To completely reset the database and destroy all chat history:

```powershell
cd docker
docker compose down
docker volume rm local-ollama-pgdata
docker compose up -d
```

Data reset no longer requires a manual `npm run db:migrate` — the server container automatically applies all migrations on next boot.

---

## Cloudflare Tunnel

> **Important**: Always point your Cloudflare Tunnel at port **8080** (nginx), not 3000 (backend) or 11434 (Ollama).
> Port 8080 serves the application UI and enforces token authentication on every `/api/*` call.

### Ephemeral tunnel (quick test)

```powershell
cloudflared tunnel --url http://localhost:8080
```

Copy the generated `https://...trycloudflare.com` URL.

### Setting PUBLIC_URL in docker/.env

To have the startup banner display your tunnel URL, add `PUBLIC_URL` to `docker/.env`:

```env
PUBLIC_URL=https://your-tunnel-name.trycloudflare.com
```

When you start or restart the stack (`docker compose up -d`), the banner prints:

```
================================================================
  Local Ollama Chat Interface is ready
================================================================
  Open in browser:  https://your-tunnel-name.trycloudflare.com
  API Token:        [persisted] sha256:7f3a8b1c...
  Ollama URL:       http://localhost:11434

  To show this banner again: docker compose logs server
================================================================
```

### Named tunnel (stable URL)

For a stable custom domain, create a Cloudflare Named Tunnel in Cloudflare Zero Trust:
1. In Zero Trust Dashboard → Networks → Tunnels → Create a Tunnel.
2. Configure ingress rule: Service `http://localhost:8080`.
3. Add Cloudflare Access policies in front of the tunnel for team login protection (Google/SAML/email OTP).

---

## Ollama

Ollama runs **on the host machine**, not inside Docker. This allows direct GPU acceleration and shared local model weights.

```powershell
ollama serve              # start Ollama daemon
ollama pull qwen2.5:7b    # pull desired model
ollama list               # list installed models
```

The `server` container reaches host Ollama via `host.docker.internal:11434` (configured via `extra_hosts` in `compose.yaml`).

---

## Web Search (Optional)

Web search augmentation enriches Ollama responses with current web information via [SearXNG](https://github.com/searxng/searxng).

### How it works
- **Context injection (not a vector DB)**: On each chat message, the backend issues a search query to SearXNG, retrieves up to 5 relevant snippets, formats them as citation context, and injects them only into the prompt for the latest user turn.
- **Fail-soft**: If SearXNG is unreachable, times out, or returns no results, the request continues without context and Ollama answers normally without user-facing errors.
- **Database hygiene**: Raw user messages are persisted in PostgreSQL without the injected context, ensuring your chat history stays clean.

### Latency and Token Overhead
- **Latency**: Web search adds approximately 500ms to 1500ms of latency per message before token generation begins (capped by a 5-second backend timeout).
- **Context window**: Search results consume an additional ~300 to 800 tokens of the LLM context window per turn.

### Using an External SearXNG Instance
If you already run a SearXNG instance or prefer an external one, set `SEARXNG_URL` in `docker/.env`:
```env
SEARXNG_URL=https://searx.yourdomain.com
```

### Privacy Notice
When web search is enabled, the text of your chat query is sent by the server container to the configured SearXNG service to fetch search results from web search engines.

### How to Disable Web Search
To completely disable web search and remove the SearXNG container:
1. In `docker/compose.yaml`, remove the `searxng` service block and the `searxng:` dependency from `server.depends_on`.
2. Remove or comment out `SEARXNG_URL` in `docker/compose.yaml` and `docker/.env`.
3. Re-run `docker compose up -d`.

---

## Security

| Layer | Mechanism |
|---|---|
| API auth | `Authorization: Bearer <token>` required on every route except `/api/v1/health` |
| Token storage | Browser `localStorage` (key `apiToken`) — per client, never exposed in URLs |
| Auth verification | `GET /api/v1/auth/verify` tests token validity before storage (`Cache-Control: no-store`) |
| Token display rule | Token is shown in the boot banner only on first generation (or when `API_TOKEN_FORCE_DISPLAY=true`). Subsequent boots show fingerprint only. |
| Disk permissions | Container token file written with POSIX mode `0600` owned by server user |
| SSRF protection | `OLLAMA_ALLOWED_HOSTS` allowlist blocks private IPs, metadata services, and unlisted domains |
| Path locking | Backend only issues requests to `/api/chat` and `/api/tags` on target Ollama |
| Tunnel exposure | Nginx (8080) only — raw Express API (3000) and Ollama (11434) are not exposed externally |

---

## Monorepo structure

```
apps/
  server/           Express + Drizzle ORM + Ollama client
    drizzle/        Generated SQL migration files
    src/
      config/       env validation (Zod)
      db/           schema + Drizzle client + migrate.ts runner
      lib/          logger, token resolver, startup banner, graceful shutdown
      middleware/   auth (Bearer token)
      modules/
        auth/       auth routes (GET /api/v1/auth/verify) + controller
        chat/       chat controller + service + routes
        health/     health check route
        ollama/     ollama client + SSRF allowlist + test route
        search/     search service + debug route
    entrypoint.sh   Container boot script: migrate → run
    Dockerfile      Multi-stage: build → node:22-alpine runtime
  web/              React + Vite + Tailwind CSS
    src/
      components/   ChatWindow, Composer, Sidebar, SettingsModal, FirstRunModal
      hooks/        useChat, useConnection, useTheme
      lib/          api.ts (fetch + auth verification), ollama.ts
    Dockerfile      Multi-stage: build → nginx:1.27-alpine serve
packages/
  shared/           TypeScript types shared across server and web
docker/
  compose.yaml      db + server + web + searxng services + named volumes
  nginx.conf        static frontend serve + /api/* reverse proxy (SSE streaming)
  searxng/          SearXNG settings.yml configuration
  .env              Optional deployment overrides (git-ignored)
  .env.example      Template with documentation for all compose variables
```

---

## Providers UI (Phase 2)

Beacon Flux supports both native local Ollama and any OpenAI-compatible cloud provider (Groq, Together AI, OpenRouter, DeepSeek, Mistral, LM Studio, vLLM).

### Key Features
- **Tabbed Settings Modal**: Seamlessly toggle between Ollama **Connection** settings and **Providers** management.
- **Provider Management**: Add, edit, delete, and test custom OpenAI-compatible providers with quick presets.
- **Encrypted Keys**: Provider API keys are encrypted at rest using AES-256-GCM and masked in the UI — secrets are never exposed in plaintext in the DOM.
- **Two-Level Model Picker**: The sidebar model selector provides a two-level picker (`Provider ▸ Model`) when cloud providers are configured, auto-selecting default models on provider change.
- **SSRF Hardening**: Custom provider base URLs are validated to prevent private IP and metadata service access.
- **Graceful Fallback (G16)**: If connected to a pre-2.1 backend where `/api/v1/providers` is unavailable, the UI gracefully falls back to single-dropdown Ollama mode without disruption.
- **Architecture Stability (D7)**: `apps/web/src/lib/ollama.ts` remains completely untouched; `apps/web/src/lib/providers.ts` is purely additive, ensuring existing Ollama logic and connection health checks remain 100% stable.

---

## Rebuilding after source changes

```powershell
cd docker

# After changing backend source:
docker compose build server && docker compose up -d server

# After changing frontend source:
docker compose build web && docker compose up -d web

# After changing packages/shared (affects both):
docker compose build server web && docker compose up -d
```

---

## Backup

To back up database chats:

```powershell
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
docker run --rm `
  -v local-ollama-pgdata:/data:ro `
  -v "${PWD}\backups:/backup" `
  alpine `
  sh -c "cd /data && tar czf /backup/pgdata-$stamp.tar.gz ."
```

---

## Troubleshooting

- **Modal rejects token**: Check `docker compose logs server | Select-String "API Token"` to copy the exact token. Ensure no trailing whitespace or extra characters were pasted.
- **Token invalid toast on reload**: If the `local-ollama-api-token` volume was deleted or recreated, the server generated a new token. Retrieve the new token via `docker compose exec server cat /app/data/api-token` and paste it into Settings.
- **Migration failed at boot**: Check container logs with `docker compose logs server`. Verify PostgreSQL container is healthy and `local-ollama-pgdata` volume is not corrupted.

---

## Known limitations (v1)

- **Single user** — token is a shared secret; no per-user accounts.
- **Shared chat history** — all devices and browsers connected to the backend see the same chat database.
- **Model not persisted per chat** — switching models mid-chat affects subsequent responses in that session.
- **No rate limiting** — add `express-rate-limit` before exposing to public untrusted traffic.
- **Chunk size warning** — Vite bundle exceeds 500 kB; code-splitting / dynamic imports planned for v2.
- **Volume persistence** — Auto-generated token is stored in a Docker volume named `local-ollama-api-token`; if the volume is removed, clients must re-verify (re-paste or run Settings).

---

## Feature set (v1)

- Monorepo scaffold (npm workspaces)
- Postgres persistence with Drizzle ORM + migrations
- Ollama proxy with SSE streaming (progressive token rendering)
- Full chat history UI with sidebar
- Docker deployment (db + server + web, one `docker compose up -d`)
- nginx serving React SPA + proxying `/api/*` with SSE support
- Shared TypeScript types (`packages/shared`)
- Bearer token auth — required on every API route
- Pino structured logging + graceful shutdown + `X-Request-Id` headers
- Client-supplied Ollama URL with SSRF allowlist
- Token stored in `localStorage`, sent as `Authorization` header
- First-run guided modal with inline token verification
- One-command full-stack deployment + Cloudflare Tunnel support
- Auto-generated API token on first boot with 0600 disk persistence (Part 1)
- Auto-applied DB migrations on container boot sharing `drizzle.__drizzle_migrations` (Part 2)
- Boot banner with URL + token and fingerprint security (Part 3)
- First-run frontend modal with token verification against `/api/v1/auth/verify` (Part 4)
