# NX Monorepo Migration -- Design Spec

**Date:** 2026-04-06
**Status:** Approved

## Overview

Migrate the Tab Zen project from a single-package structure into an NX monorepo with Bun workspaces. The extension and sync service become separate apps, and shared types move into a dedicated package. The structure is designed to accommodate future growth: a content/AI API service, a web application, mobile apps, and a shared auth layer.

## Goals

- Separate the Chrome extension and Cloudflare sync service into independent apps with their own dependencies and build tooling
- Extract shared types into a package that both apps (and future apps) can import with type safety
- Use NX for task orchestration and caching without replacing existing build tools (WXT, Wrangler)
- Use Bun for package management and development
- Make adding future apps and shared packages trivial

## Target Structure

```
tab-zen/
├── nx.json
├── package.json               # Root: bun workspaces, NX convenience scripts
├── tsconfig.base.json         # Shared TS config, extended by each package
├── .gitignore
├── apps/
│   ├── extension/             # Chrome extension (WXT + SolidJS)
│   │   ├── package.json
│   │   ├── wxt.config.ts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   ├── entrypoints/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── assets/
│   │   ├── public/
│   │   └── tests/
│   └── sync-service/          # Cloudflare Worker (Hono)
│       ├── package.json
│       ├── wrangler.toml
│       ├── tsconfig.json
│       ├── schema.sql
│       ├── setup.sh
│       ├── migrations/
│       └── src/
├── packages/
│   └── shared/                # Shared types (no runtime code)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts       # Barrel re-export
│           └── types.ts       # Tab, Group, Capture, SyncPayload
└── docs/
```

## Tooling Decisions

### NX with Inferred Tasks

NX auto-detects tasks from each package's `package.json` scripts. No `project.json` files. Each app keeps its own build tool:

- **Extension:** WXT handles dev server, build, zip
- **Sync service:** Wrangler handles dev server, deploy
- **Future apps:** Bring their own tooling

NX provides: dependency graph awareness, task caching, `run-many` for parallel builds/tests.

### Bun Workspaces

Root `package.json` declares workspaces:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Single `bun.lock` at root. All dependency management via Bun.

### TypeScript Configuration

A `tsconfig.base.json` at root with shared compiler options. Each app/package extends it:

```json
{
  "extends": "../../tsconfig.base.json"
}
```

Path aliases configured so `@tab-zen/shared` resolves correctly in each consumer.

## Shared Package: `@tab-zen/shared`

### Contents

Types used by both the extension and sync service:

| Type | Description |
|------|-------------|
| `Tab` | Core tab data model |
| `Group` | Tab group data model |
| `Capture` | Capture session data model |
| `SyncPayload` | Push/pull request/response contract |

### What Stays in the Extension

Extension-only types remain in `apps/extension/lib/types.ts`:

| Type | Reason |
|------|--------|
| `Settings` | Extension settings, not used by backend |
| `DEFAULT_SETTINGS` | Runtime constant with extension-specific values |
| `AIGroupSuggestion` | AI grouping UI, extension only |
| `CapturePreviewData` | Capture preview UI, extension only |

### No Build Step

The shared package is raw TypeScript consumed directly by consumers via TypeScript path resolution. No compilation, no output directory. This keeps it zero-config.

### Package Name

`@tab-zen/shared` -- scoped to `@tab-zen` so future packages follow the same convention (`@tab-zen/auth`, `@tab-zen/api-client`, etc.).

## Migration: What Moves Where

| Current Location | New Location |
|---|---|
| `entrypoints/` | `apps/extension/entrypoints/` |
| `components/` | `apps/extension/components/` |
| `lib/` | `apps/extension/lib/` |
| `assets/` | `apps/extension/assets/` |
| `public/` | `apps/extension/public/` |
| `tests/` | `apps/extension/tests/` |
| `wxt.config.ts` | `apps/extension/wxt.config.ts` |
| `tailwind.config.ts` | `apps/extension/tailwind.config.ts` |
| `postcss.config.js` | `apps/extension/postcss.config.js` |
| `vitest.config.ts` | `apps/extension/vitest.config.ts` |
| `sync-service/*` | `apps/sync-service/` |
| `lib/types.ts` (shared types) | `packages/shared/src/types.ts` |
| `lib/types.ts` (extension-only) | `apps/extension/lib/types.ts` (stays, trimmed) |
| Root `tsconfig.json` | `tsconfig.base.json` (root) + per-app `tsconfig.json` |
| Root `package.json` dependencies | Split into per-app `package.json` files |

## Import Changes

```typescript
// Before (in extension)
import type { Tab, Group, SyncPayload } from "./types";

// After (in both extension and sync-service)
import type { Tab, Group, SyncPayload } from "@tab-zen/shared";
```

The sync service gains proper type safety -- its `mapTab`/`mapGroup`/`mapCapture` functions will return typed objects instead of `any`.

## Root Package Scripts

Convenience scripts that delegate to NX:

```json
{
  "scripts": {
    "dev": "nx run extension:dev",
    "dev:sync": "nx run sync-service:dev",
    "build": "nx run-many --target=build",
    "test": "nx run-many --target=test",
    "deploy:sync": "nx run sync-service:deploy"
  }
}
```

## Future Growth Path

This structure is designed for the planned expansion:

| Future Addition | Location | Notes |
|---|---|---|
| Content/AI API service | `apps/content-api/` | Cloudflare Worker, uses `@tab-zen/shared` |
| Web application | `apps/web/` | Brings its own framework |
| Mobile apps | `apps/mobile/` or separate repo | TBD based on native vs React Native decision |
| Shared auth | `packages/auth/` | Used by all apps once auth layer is built |
| API client | `packages/api-client/` | Shared HTTP client for content-api |

Adding a new app = create folder in `apps/`, add `package.json`, done.
Adding a new shared package = create folder in `packages/`, add `package.json`, done.

## Files to Delete After Migration

These root-level files become redundant after their contents move into apps:

- `package-lock.json` (replaced by root `bun.lock`)
- `tsconfig.json` (replaced by `tsconfig.base.json`)
- `wxt.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts` (moved to `apps/extension/`)

## Constraints

- Bun for all package management and script execution
- WXT remains the extension build tool -- NX does not replace it
- Wrangler remains the Cloudflare Worker build/deploy tool
- No runtime code in the shared package (types only, for now)
- Each app must be independently buildable and deployable
