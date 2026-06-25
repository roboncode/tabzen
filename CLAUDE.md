# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tab Zen is an AI-powered browser tab organizer: a Chrome/Firefox extension that captures, groups, searches, and annotates open tabs into a persistent collection. The repo is an NX + pnpm monorepo containing the extension plus its supporting services (sync backend, content-extraction workers, an optional local desktop data service, a chat component library, and docs).

Use **pnpm** (v9+, Node 20+) for everything — never npm or bun. NX orchestrates cross-project tasks and caches `build`/`test`.

## Commands

Run from the repo root unless noted. Root scripts wrap `nx run <project>:<target>`.

```bash
pnpm install                  # bootstrap workspace
pnpm dev                      # extension dev (WXT HMR, auto-loads in Chrome) — the common one
pnpm dev:api                  # sync worker (Cloudflare) locally
pnpm dev:youtube / dev:tiktok # content-extraction workers locally (tsx)
pnpm dev:chat                 # chat-app demo (Vite)
pnpm dev:docs                 # VitePress docs

pnpm build                    # build all projects (nx run-many)
pnpm test                     # all tests (nx run-many)

pnpm deploy:api               # deploy sync worker to Cloudflare
pnpm deploy:youtube / deploy:tiktok
pnpm storybook:chat           # Storybook for @tab-zen/chat
```

Per-project work (preferred when iterating on one thing):

```bash
pnpm nx run extension:build           # or any <project>:<target>
pnpm nx test extension                # one project's tests

# Single test file / single test — cd into the app and call vitest directly:
cd apps/extension && pnpm exec vitest run tests/youtube.test.ts
cd apps/extension && pnpm exec vitest run -t "duplicate detection"

cd apps/extension && pnpm compile     # type-check only (tsc --noEmit)
```

NX project names: `extension`, `api`, `content-youtube`, `content-tiktok`, `docs`, `@tab-zen/chat-app`, `tabzen-service-frontend`, plus libraries `@tab-zen/shared`, `@tab-zen/chat`, `@tab-zen/content-types`. The Go desktop service (`apps/service`) is built with Wails v3 (`wails3 dev` / `wails3 build` inside that dir), not NX.

Extension production output lands in `apps/extension/.output/chrome-mv3/`; load it via `chrome://extensions` → Developer mode → Load unpacked.

> The README's "Project Structure" / sync sections are partly stale (it calls the sync app `sync-service` with `dev:sync`/`deploy:sync` scripts). The real app is `apps/api` with `dev:api`/`deploy:api`. Trust `package.json` scripts over the README.

## Architecture

### Extension (`apps/extension`) — WXT + SolidJS + Tailwind v4

WXT entrypoints (`entrypoints/`):
- `background.ts` — service worker; owns capture, search, AI search, content/transcript extraction, sync. The single source of truth for privileged actions.
- `content.ts`, `notch.content.ts` — content scripts (OG/meta + Readability article extraction, on-page UI).
- `index/` — the main SolidJS SPA (`@solidjs/router`), served as **both** the Chrome side panel and the full-page tab view.
- `popup/` — quick-action popup.

UI ↔ background communicate through a **typed message bus** in `lib/messages.ts`: a discriminated `MessageRequest`/`MessageResponse` union sent via `browser.runtime.sendMessage`. Add new cross-context actions by extending those unions and handling them in `background.ts`.

### Data layer — pluggable adapter (the key pattern)

All persistence goes through a `DataAdapter` interface (`lib/adapters/types.ts`) covering pages, groups, captures, AI templates, and AI documents. Two implementations:
- `adapters/indexeddb-adapter.ts` — default, local-only, via `idb`.
- `adapters/service-adapter.ts` — HTTP to the local desktop service at `http://localhost:7824/api`.

`lib/data-layer.ts` + `lib/adapter-state.ts` pick the active adapter from the `dataSource` setting (`local` | `auto` | `service`). `auto` health-checks the service (`/api/health`, 30s interval) and silently falls back to IndexedDB. **Never call `db.ts` / a specific adapter directly from feature code** — route through the data layer so both backends stay interchangeable.

### Desktop service (`apps/service`) — optional local backend

Wails v3 app: Go backend + minimal SolidJS frontend, runs as a macOS tray/accessory. Exposes an HTTP API on `localhost:7824` (`internal/server/routes.go`, Go 1.22 `ServeMux` method routing) backed by SQLite/libSQL (`internal/db`). Its routes mirror the `DataAdapter` surface (`/api/pages`, `/api/groups`, `/api/captures`, `/api/templates`, `/api/documents`, `/api/batch`), letting any browser on the machine share one collection. When you change the `DataAdapter` interface, keep these Go handlers in sync.

### AI & chat

- AI calls go through OpenRouter (`lib/ai.ts`); the extension fully degrades to domain-based grouping with no API key.
- **Prompts are editable markdown, not hardcoded.** Files live in `apps/extension/prompts/*.md` (and `prompts/chat-skills/`), imported as strings via Vite's `?raw` (see `lib/templates.ts`, `lib/chat/chat-skills.ts`). Edit/add prompts by touching those files. `templates.ts` seeds built-in AI "document" templates (Summary, Key Points, etc.) into storage.
- Chat subsystem in `lib/chat/` (store, streaming, context-manager, compression, skills, voice, title) renders with components from the `@tab-zen/chat` library.

### Content extraction — browser-first, API fallback

Preferred path extracts in-browser (content scripts: OG metadata, Readability, YouTube transcripts). When a tab isn't open, `lib/content-api.ts` falls back to the content workers. `content-youtube` and `content-tiktok` are **dual-runtime Hono apps**: `src/app.ts` is the shared app, `src/index.ts` is the Node entry (`tsx` dev/start), `src/worker.ts` is the Cloudflare Workers entry (`workers:dev`/`workers:deploy`). Shared extraction types/cache/queue live in `@tab-zen/content-types`.

### Sync (`apps/api`)

Cloudflare Workers + Hono + D1 + KV. Token-based auth (`src/middleware/auth.ts`); routes split into `sync` and `content`. Provides cross-browser collection sync (`SYNC_NOW` message → `lib/sync.ts`). Schema/migrations in `apps/api/migrations/`.

### Shared packages

- `@tab-zen/shared` — cross-cutting domain types, including `chat-types`.
- `@tab-zen/chat` — layered SolidJS chat component library (headless primitives → UI primitives → AI/feature components), built on Kobalte; has Storybook.
- `@tab-zen/content-types` — content-extraction types, caching, queue, storage helpers.

## Conventions & gotchas

- **Path aliases:** `@/` → `apps/extension` root; `@tab-zen/shared` and `@tab-zen/content-types` resolve to package `src/index.ts` (see `tsconfig.base.json` and `apps/extension/vitest.config.ts`). Kobalte is public-hoisted via `.npmrc`.
- **Tests:** Vitest, `happy-dom` environment for the extension; some browser/Playwright-based tests exist in `@tab-zen/chat` and `chat-app`.
- **Design system:** no separating borders — use background shading (`bg-muted/30…50`) and spacing; pill-style tabs; minimum `text-sm` for content (`text-xs` only for tertiary metadata). Full reference in `tmp/design-system.md`.
- **Worktrees:** when creating a git worktree, copy `apps/extension/.env.local` into it (it's gitignored but needed for the extension to run).
- Always use typed interfaces for data structures; don't introduce untyped `any` shapes for domain data.
