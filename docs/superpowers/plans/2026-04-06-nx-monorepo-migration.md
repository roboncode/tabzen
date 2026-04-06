# NX Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Tab Zen project into an NX monorepo with `apps/extension`, `apps/sync-service`, and `packages/shared`.

**Architecture:** Bun workspaces + NX with inferred tasks. Each app keeps its own build tool (WXT for extension, Wrangler for sync service). Shared types package consumed as raw TypeScript via path aliases.

**Tech Stack:** NX, Bun, WXT, Wrangler, Hono, SolidJS, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-nx-monorepo-design.md`

---

### Task 1: Create Root Workspace Configuration

**Files:**
- Create: `nx.json`
- Create: `tsconfig.base.json`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `nx.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/nrwl/nx/master/packages/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "cache": true
    }
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

This is the shared base config. The extension's WXT-generated tsconfig and the sync service's config will both extend this.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@tab-zen/shared": ["packages/shared/src/index.ts"]
    }
  }
}
```

- [ ] **Step 3: Replace root `package.json`**

Replace the current root `package.json` with the workspace root version. All extension dependencies move out in Task 3.

```json
{
  "name": "tab-zen",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "nx run extension:dev",
    "dev:sync": "nx run sync-service:dev",
    "build": "nx run-many --target=build",
    "test": "nx run-many --target=test",
    "deploy:sync": "nx run sync-service:deploy"
  },
  "devDependencies": {
    "nx": "^21.0.0"
  }
}
```

- [ ] **Step 4: Update `.gitignore`**

Append NX-specific ignores to the existing `.gitignore`:

```
# NX
.nx/cache
.nx/workspace-data
```

- [ ] **Step 5: Commit**

```bash
git add nx.json tsconfig.base.json package.json .gitignore
git commit -m "chore: add NX workspace root configuration"
```

---

### Task 2: Create Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@tab-zen/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts`**

Extract the shared types from `lib/types.ts`. These are the types used by both the extension and sync service:

```typescript
export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  metaDescription: string | null;
  creator: string | null;
  creatorAvatar: string | null;
  creatorUrl: string | null;
  publishedAt: string | null;
  tags: string[];
  notes: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  capturedAt: string;
  sourceLabel: string;
  deviceId: string;
  archived: boolean;
  starred: boolean;
  deletedAt: string | null;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  captureId: string;
  position: number;
  archived: boolean;
}

export interface Capture {
  id: string;
  capturedAt: string;
  sourceLabel: string;
  tabCount: number;
}

export interface SyncPayload {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  settings?: {
    aiModel: string;
    encryptedApiKey: string | null;
  };
  lastSyncedAt: string;
}
```

- [ ] **Step 4: Create `packages/shared/src/index.ts`**

Barrel export:

```typescript
export type { Tab, Group, Capture, SyncPayload } from "./types";
```

- [ ] **Step 5: Commit**

```bash
git add packages/
git commit -m "feat: add @tab-zen/shared types package"
```

---

### Task 3: Move Extension Into `apps/extension/`

This is the bulk move. All extension source files move into `apps/extension/`.

**Files:**
- Create: `apps/extension/package.json`
- Move: `entrypoints/` -> `apps/extension/entrypoints/`
- Move: `components/` -> `apps/extension/components/`
- Move: `lib/` -> `apps/extension/lib/`
- Move: `assets/` -> `apps/extension/assets/`
- Move: `public/` -> `apps/extension/public/`
- Move: `tests/` -> `apps/extension/tests/`
- Move: `wxt.config.ts` -> `apps/extension/wxt.config.ts`
- Move: `tailwind.config.ts` -> `apps/extension/tailwind.config.ts`
- Move: `postcss.config.js` -> `apps/extension/postcss.config.js`
- Move: `vitest.config.ts` -> `apps/extension/vitest.config.ts`

- [ ] **Step 1: Create `apps/extension/` directory and move source files**

```bash
mkdir -p apps/extension
git mv entrypoints apps/extension/
git mv components apps/extension/
git mv lib apps/extension/
git mv assets apps/extension/
git mv public apps/extension/
git mv tests apps/extension/
git mv wxt.config.ts apps/extension/
git mv tailwind.config.ts apps/extension/
git mv postcss.config.js apps/extension/
git mv vitest.config.ts apps/extension/
```

- [ ] **Step 2: Create `apps/extension/package.json`**

This gets all the extension-specific dependencies from the old root `package.json`:

```json
{
  "name": "extension",
  "description": "Tab Zen Chrome Extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "test": "vitest run",
    "test:watch": "vitest",
    "compile": "tsc --noEmit",
    "postinstall": "wxt prepare"
  },
  "dependencies": {
    "@tab-zen/shared": "workspace:*",
    "@wxt-dev/storage": "^1.2.8",
    "idb": "^8.0.3",
    "lucide-solid": "^1.7.0",
    "solid-js": "^1.9.11",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.2",
    "@types/uuid": "^10.0.0",
    "@vitest/browser": "^4.1.2",
    "@wxt-dev/module-solid": "^1.1.4",
    "autoprefixer": "^10.4.27",
    "happy-dom": "^20.8.9",
    "postcss": "^8.5.8",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.9.3",
    "vitest": "^4.1.2",
    "wxt": "^0.20.20"
  }
}
```

- [ ] **Step 3: Create `apps/extension/tsconfig.json`**

The extension tsconfig extends the WXT-generated one (which WXT manages) and adds the shared package path:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "paths": {
      "@tab-zen/shared": ["../../packages/shared/src/index.ts"],
      "@/*": ["./*"]
    }
  }
}
```

Note: WXT generates `.wxt/tsconfig.json` during `wxt prepare`. The `@/*` alias that was previously resolved by vitest config also needs to be in the tsconfig for editor support. Check the WXT-generated tsconfig after running `wxt prepare` -- if it already defines `@/*` paths, remove the duplicate from here and only add the `@tab-zen/shared` path.

- [ ] **Step 4: Update `apps/extension/vitest.config.ts`**

Update the path alias to resolve correctly from the new location:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@tab-zen/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
  },
});
```

- [ ] **Step 5: Commit the move**

```bash
git add apps/extension/
git commit -m "refactor: move extension source into apps/extension/"
```

---

### Task 4: Move Sync Service Into `apps/sync-service/`

**Files:**
- Move: `sync-service/` -> `apps/sync-service/`
- Modify: `apps/sync-service/package.json`
- Modify: `apps/sync-service/tsconfig.json`

- [ ] **Step 1: Move the sync service directory**

```bash
git mv sync-service apps/sync-service
```

- [ ] **Step 2: Update `apps/sync-service/package.json`**

Add the shared dependency:

```json
{
  "name": "sync-service",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@tab-zen/shared": "workspace:*",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250327.0",
    "typescript": "^5.9.3",
    "wrangler": "^4.10.0"
  }
}
```

- [ ] **Step 3: Update `apps/sync-service/tsconfig.json`**

Extend the base tsconfig and add the shared path:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "paths": {
      "@tab-zen/shared": ["../../packages/shared/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Commit the move**

```bash
git add apps/sync-service/
git commit -m "refactor: move sync-service into apps/sync-service/"
```

---

### Task 5: Update Extension Imports to Use `@tab-zen/shared`

**Files:**
- Modify: `apps/extension/lib/types.ts` (remove shared types, keep extension-only)
- Modify: `apps/extension/lib/sync.ts`
- Modify: `apps/extension/lib/db.ts`
- Modify: `apps/extension/lib/export.ts`
- Modify: `apps/extension/lib/domains.ts`
- Modify: `apps/extension/lib/ai.ts`
- Modify: `apps/extension/lib/messages.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/components/TabCollection.tsx`
- Modify: `apps/extension/components/TabCard.tsx`
- Modify: `apps/extension/components/TabRow.tsx`
- Modify: `apps/extension/components/GroupSection.tsx`
- Modify: `apps/extension/components/NotesEditor.tsx`
- Modify: `apps/extension/components/NoteCard.tsx`
- Modify: `apps/extension/components/CapturePreview.tsx`
- Modify: `apps/extension/components/FilterPills.tsx`
- Modify: `apps/extension/tests/capture-flow.test.ts`

- [ ] **Step 1: Trim `apps/extension/lib/types.ts`**

Remove `Tab`, `Group`, `Capture`, and `SyncPayload` (they now live in `@tab-zen/shared`). Re-export them from the shared package so existing `@/lib/types` imports still work for these types. Keep extension-only types in place:

```typescript
// Re-export shared types so existing imports continue to work
export type { Tab, Group, Capture, SyncPayload } from "@tab-zen/shared";

export interface Settings {
  deviceId: string;
  sourceLabel: string;
  openRouterApiKey: string;
  aiModel: string;
  syncEnabled: boolean;
  syncToken: string | null;
  syncLocalToken: string | null;
  syncUrl: string;
  syncLocalUrl: string;
  syncEnv: "local" | "remote";
  blockedDomains: string[];
  openMode: "new-tab" | "current-tab";
  syncError: string | null;
  viewMode: "cards" | "rows";
  activeFilter: "all" | "starred" | "notes" | "byDate" | "archived" | "duplicates" | "trash";
}

export const DEFAULT_SETTINGS: Settings = {
  deviceId: "",
  sourceLabel: "Chrome - Default",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  syncEnabled: false,
  syncToken: null,
  syncLocalToken: null,
  syncUrl: "",
  syncLocalUrl: "http://localhost:8787",
  syncEnv: "local",
  openMode: "new-tab",
  syncError: null,
  blockedDomains: [
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "baidu.com",
    "yandex.com",
    "search.brave.com",
    "newtab",
    "extensions",
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    "accounts.google.com",
    "login.microsoftonline.com",
    "auth0.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "paypal.com",
    "localhost",
    "127.0.0.1",
    "chromewebstore.google.com",
  ],
  viewMode: "cards",
  activeFilter: "all",
};

export interface AIGroupSuggestion {
  groupName: string;
  tabIds: string[];
}

export interface CapturePreviewData {
  captureId: string;
  groups: AIGroupSuggestion[];
  tabs: Tab[];
}
```

This approach means **no other extension files need import changes** -- they all import from `@/lib/types` which re-exports the shared types. Only `lib/sync.ts` uses a relative import from `./types` which also still works.

- [ ] **Step 2: Verify no import changes needed in other extension files**

Because `apps/extension/lib/types.ts` re-exports the shared types, all existing imports like `import type { Tab } from "@/lib/types"` and `import type { SyncPayload } from "./types"` continue to work unchanged.

Run a quick check:

```bash
cd apps/extension && grep -r "from.*@tab-zen/shared" . || echo "No direct shared imports yet (expected -- re-exports handle it)"
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "refactor: extract shared types to @tab-zen/shared, re-export from extension"
```

---

### Task 6: Update Sync Service to Use `@tab-zen/shared`

**Files:**
- Modify: `apps/sync-service/src/index.ts`

- [ ] **Step 1: Add shared type imports and type the mapper functions**

At the top of `apps/sync-service/src/index.ts`, add the import:

```typescript
import type { Tab, Group, Capture, SyncPayload } from "@tab-zen/shared";
```

- [ ] **Step 2: Type the mapper functions**

Replace the untyped `mapTab`, `mapGroup`, `mapCapture` functions (currently inside the `/sync/pull` handler around lines 188-221) with typed versions:

```typescript
  const mapTab = (row: Record<string, unknown>): Tab => ({
    id: row.id as string,
    url: row.url as string,
    title: row.title as string,
    favicon: row.favicon as string,
    ogTitle: row.og_title as string | null,
    ogDescription: row.og_description as string | null,
    ogImage: row.og_image as string | null,
    metaDescription: row.meta_description as string | null,
    creator: row.creator as string | null,
    creatorAvatar: row.creator_avatar as string | null,
    creatorUrl: row.creator_url as string | null,
    publishedAt: row.published_at as string | null,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    notes: row.notes as string | null,
    viewCount: row.view_count as number,
    lastViewedAt: row.last_viewed_at as string | null,
    capturedAt: row.captured_at as string,
    sourceLabel: row.source_label as string,
    deviceId: (row.device_id as string) || "",
    archived: !!row.archived,
    starred: !!row.starred,
    deletedAt: row.deleted_at as string | null,
    groupId: row.group_id as string,
  });

  const mapGroup = (row: Record<string, unknown>): Group => ({
    id: row.id as string,
    name: row.name as string,
    captureId: row.capture_id as string,
    position: row.position as number,
    archived: !!row.archived,
  });

  const mapCapture = (row: Record<string, unknown>): Capture => ({
    id: row.id as string,
    capturedAt: row.captured_at as string,
    sourceLabel: row.source_label as string,
    tabCount: row.tab_count as number,
  });
```

Note: Some fields (`creator`, `creatorAvatar`, `creatorUrl`, `publishedAt`, `tags`, `deletedAt`) may not exist in the D1 schema yet. The mapper handles missing columns by casting -- they'll return `null`/`[]` for rows that don't have these columns. If the D1 schema needs updating to match, that's a separate task outside this migration.

- [ ] **Step 3: Type the response in the pull handler**

Replace the untyped return object with:

```typescript
  const result: SyncPayload = {
    tabs: tabs.results.map(mapTab),
    groups: groups.results.map(mapGroup),
    captures: captures.results.map(mapCapture),
    settings: settingsRow ? {
      aiModel: settingsRow.ai_model as string,
      encryptedApiKey: settingsRow.encrypted_api_key as string | null,
    } : undefined,
    lastSyncedAt: new Date().toISOString(),
  };

  return c.json(result);
```

- [ ] **Step 4: Type the push handler body**

In the `/sync/push` handler, type the incoming body:

```typescript
  const body = await c.req.json() as SyncPayload;
```

- [ ] **Step 5: Commit**

```bash
git add apps/sync-service/src/index.ts
git commit -m "refactor: use @tab-zen/shared types in sync service"
```

---

### Task 7: Clean Up Root and Install Dependencies

**Files:**
- Delete: root `tsconfig.json` (replaced by `tsconfig.base.json`)
- Delete: root `package-lock.json` (replaced by root `bun.lock`)
- Delete: root `node_modules/` (will be recreated by bun install)
- Modify: `.gitignore`

- [ ] **Step 1: Remove old root files**

```bash
rm -f tsconfig.json package-lock.json
rm -rf node_modules
```

Also remove the old sync-service artifacts if any remain:

```bash
rm -rf sync-service
```

- [ ] **Step 2: Update `.gitignore`**

Ensure `bun.lock` is NOT ignored (it should be committed). Add `bun.lock` allowance if needed. Also ensure `node_modules` covers all workspace locations (the existing `node_modules` pattern in `.gitignore` already handles this as it matches recursively).

- [ ] **Step 3: Install all dependencies from root**

```bash
bun install
```

This creates the workspace-linked `node_modules` with `@tab-zen/shared` symlinked.

- [ ] **Step 4: Verify workspace structure**

```bash
bun pm ls
```

Should show the three packages: `extension`, `sync-service`, `@tab-zen/shared`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: clean up root, install workspace dependencies"
```

---

### Task 8: Verify Everything Works

**Files:** None (verification only)

- [ ] **Step 1: Run WXT prepare for the extension**

```bash
cd apps/extension && bunx wxt prepare
```

This regenerates `.wxt/tsconfig.json`. Verify no errors.

- [ ] **Step 2: Check extension TypeScript compilation**

```bash
cd apps/extension && bunx tsc --noEmit
```

Fix any path resolution errors. Common issues:
- The `@/*` alias may need adjusting in the WXT-generated tsconfig
- The `@tab-zen/shared` path may need to be verified

- [ ] **Step 3: Run extension tests**

```bash
cd apps/extension && bun run test
```

All existing tests should pass unchanged.

- [ ] **Step 4: Verify extension builds**

```bash
cd apps/extension && bun run build
```

Should produce `.output/` with the built extension.

- [ ] **Step 5: Verify sync service TypeScript**

```bash
cd apps/sync-service && bunx tsc --noEmit
```

- [ ] **Step 6: Verify sync service dev runs**

```bash
cd apps/sync-service && bun run dev
```

Wrangler should start the local dev server. Stop it after confirming it starts.

- [ ] **Step 7: Verify NX task graph**

```bash
bunx nx graph
```

Should show the dependency graph with `extension` and `sync-service` both depending on `@tab-zen/shared`.

- [ ] **Step 8: Run NX commands from root**

```bash
bun run test
```

Should run tests across all apps via NX.

- [ ] **Step 9: Commit any fixes**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix: resolve monorepo migration issues"
```

---

### Task 9: Remove Stale Root Files

**Files:**
- Delete: root-level files that were moved but may have leftover artifacts

- [ ] **Step 1: Check for stale files at root**

```bash
ls -la *.ts *.js 2>/dev/null
```

If `wxt.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts` still exist at root, they were already `git mv`'d in Task 3 so they should be gone. If copies remain, delete them:

```bash
rm -f wxt.config.ts tailwind.config.ts postcss.config.js vitest.config.ts
```

- [ ] **Step 2: Remove `tmp/` if no longer needed**

The `tmp/` directory at root contains `app.css` and `design-system.md`. If these are scratch files:

```bash
rm -rf tmp/
```

If they're referenced by anything, leave them.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: remove stale root files after monorepo migration"
```
