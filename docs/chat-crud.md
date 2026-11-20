# Chat CRUD Feature Spec

## Scope
Rename, delete, pin/unpin, and export for chats in the sidebar.
Implemented across 5 phases (branch per phase).

## Endpoint Contracts

### PATCH /api/v1/chats/:id — Rename
- Body: `{ title: string }` (trimmed, 1–120 chars)
- 200: `ChatSummary` (updated)
- 400: `{ error: 'Invalid body', details }`
- 404: `{ error: 'Chat not found' }`
- Side effect: sets `title` only. Does NOT bump `updatedAt`.

### DELETE /api/v1/chats/:id — Delete
- 204: no body
- 404: `{ error: 'Chat not found' }`
- Cascade: messages deleted via FK `ON DELETE CASCADE`.

### PATCH /api/v1/chats/:id/pin — Pin/Unpin
- Body: `{ pinned: boolean }`
- 200: `ChatSummary` (updated)
- 400 / 404 as above
- Side effect: sets `pinned`; `pinnedAt = now()` when true, `null` when false.
- `listChats` ordering: `ORDER BY pinned DESC, updatedAt DESC`.

### GET /api/v1/chats/:id/export?format=md|json — Export
- Query: `format` enum, default `md`
- 200 headers:
  - `Content-Type: text/markdown; charset=utf-8` or `application/json; charset=utf-8`
  - `Content-Disposition: attachment; filename="chat-<id>-<slug>.<ext>"`
  - `Cache-Control: no-store`
- md body:
  ```
  # <title>

  _Exported <ISO> · <n> messages_

  ---

  ## User
  <content>

  ## Assistant
  <content>
  ```
- json body: `{ chat: ChatSummary, messages: ChatMessage[] }`
- 400: invalid format
- 404: chat not found

## Type Changes (packages/shared)
```ts
export type ChatSummary = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  pinnedAt: string | null;
};
export type RenameChatBody = { title: string };
export type PinChatBody = { pinned: boolean };
export type ExportFormat = 'md' | 'json';
```

## Frontend Action Semantics (useChats hook)
- rename / pin: optimistic patch + re-sort, rollback on error, toast on failure
- delete: no optimistic; API → refetch `listChats()` on 204
- export: API → blob → anchor download
- Guard: all actions refuse while `isStreaming === true`
- Delete of active chat → App calls `useChat.clear()`

## Sidebar UI Behavior
- Kebab menu (`MoreVertical`) per row, hover/focus-within reveal
- Menu items: Rename / Pin·Unpin / Export MD / Export JSON / Delete
- Inline rename input (Enter save, Esc cancel, blur save, maxLength 120)
- "Pinned" section rendered above date groups
- Delete uses ConfirmDialog (role="alertdialog", focus Cancel, Esc closes)
- No new npm dependency

## Test Matrix
Server:
- T-CRUD-01..04 rename (valid / empty / too-long / 404)
- T-CRUD-05..06 delete (204+cascade / 404)
- T-CRUD-07..08 pin (true / false)
- T-CRUD-09 listChats ordering
- T-CRUD-10..13 export (md / json / bad format / 404)
- T-REG-09 touchChat preserves pinned

Web:
- T-FE-A-01..05 api.ts functions (method, URL, body, auth header, error)
- T-FE-H-01..05 useChats logic (optimistic, rollback, guard, sort)
- T-FE-S-01..07 Sidebar (kebab, pinned section, rename input, dialog, no-op, regression)

## Phase Gates
1. Schema + migration (no behavior change)
2. Backend CRUD endpoints
3. Shared types + web API client
4. Sidebar UI
5. Docs + README + full integration


## Phase Status
- Phase 1 — Schema + migration: ✅ complete
- Phase 2 — Backend CRUD endpoints: ✅ complete
- Phase 3 — Shared types + API client: ✅ complete
- Phase 4 — Sidebar UI: ✅ complete
- Phase 5 — Build fix + docs: ✅ complete (this phase)

## Deviations from Original Spec
1. **`chatRepo` namespace export (Phase 2):** chat.repo.ts now exports
   `chatRepo` as a mutable object (mirroring `providerRepo` from
   providers.repo.ts) so integration tests can stub repo methods without
   violating ESM namespace immutability. All original named exports are
   preserved; chat.service.ts still uses `import * as repo`.
2. **`packages/shared` has no separate build step (Phase 3):**
   `package.json` exports `./src/index.ts` directly; consumers bundle it.
   No `npm run build -w packages/shared` is required or meaningful.
3. **`UseChats` field names (Phase 4):** the hook returns
   `chats, loading, refresh, prependChat, rename, pin, remove, download`
   — these exact names are used in App.tsx and Sidebar.tsx.
4. **`ConfirmDialog` uses inline render, not portal (Phase 4):**
   SSR-safe by design; `renderToString` tests exercise the same code
   path as the browser.
5. **Test-mock completeness fix (Phase 5):** two pre-existing test files
   (chat.providers.test.ts, regression.test.ts) constructed `Chat`
   literals missing `pinned`/`pinnedAt`. This broke the Docker build
   because `tsc -p tsconfig.json` includes src/__tests__/. Fixed by
   adding the two fields — no test logic changed.
6. **Infinite render loop fix (Phase 4 hotfix):** `useChats` callbacks were
   originally unstable due to inline `onToast` props in App.tsx, causing an
   infinite network request loop. Fixed by stabilizing `onToast` with
   `useCallback` and bridging state/props via `useRef` in `useChats` so all
   actions maintain `[]` dependency arrays.
