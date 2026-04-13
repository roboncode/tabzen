# Tab Zen Local Service -- Design Spec

Wails v3 desktop app that provides a local libSQL-backed REST API, enabling any browser extension or future desktop/mobile app to share a single data source without sync.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Wails v3 App                    │
│  ┌────────────────┐  ┌───────────────────┐  │
│  │  Go Backend    │  │  Solid.js Frontend │  │
│  │                │  │  (placeholder,     │  │
│  │  ┌──────────┐  │  │   phase 2+ UI)    │  │
│  │  │ HTTP API │  │  └───────────────────┘  │
│  │  │ :7824    │  │                          │
│  │  └──────────┘  │  ┌───────────────────┐  │
│  │  ┌──────────┐  │  │  System Tray      │  │
│  │  │ libSQL   │  │  │  - Status icon    │  │
│  │  │ database │  │  │  - Quit           │  │
│  │  └──────────┘  │  └───────────────────┘  │
│  └────────────────┘                          │
└─────────────────────────────────────────────┘
         ▲ localhost:7824/api/*
         │
    ┌────┴─────────────────────────┐
    │  Any browser extension       │
    │  LocalServiceAdapter         │
    │  (falls back to IndexedDB    │
    │   if service unreachable)    │
    └──────────────────────────────┘
```

### Key Decisions

- **Port 7824** ("TZEN" on a phone keypad), configurable if conflicts arise
- **Go standard library** `net/http` for HTTP server (no framework)
- **libSQL** via `go-libsql` for storage (CGO required)
- **Database path**: OS-standard app data (`~/Library/Application Support/TabZen/tabzen.db` on macOS, equivalent on Windows/Linux)
- **Wails v3** (alpha) for system tray, cross-platform builds
- **Solid.js** frontend (minimal placeholder in phase 1)
- **No dual-write**: when the service is active, extension does not write to IndexedDB

---

## API Surface

All endpoints prefixed with `/api`. All request/response bodies are JSON.

### Health & Discovery

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | `{ status: "ok", version: "0.1.0" }` -- extension uses this to detect the service |

### Pages

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/pages` | List pages. Query params: `?archived=bool`, `?starred=bool`, `?groupId=X`, `?search=text`, `?limit=N`, `?offset=N` |
| GET | `/api/pages/{id}` | Get single page |
| POST | `/api/pages` | Create page(s) -- accepts single object or array |
| PUT | `/api/pages/{id}` | Update page |
| DELETE | `/api/pages/{id}` | Soft delete (sets `deleted_at`) |

### Groups

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| PUT | `/api/groups/{id}` | Update group |
| DELETE | `/api/groups/{id}` | Delete group |

### Captures

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/captures` | List captures |
| POST | `/api/captures` | Create capture |

### Templates

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/templates` | List templates |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/{id}` | Update template |
| DELETE | `/api/templates/{id}` | Delete template |

### Documents

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/documents` | List documents. Query params: `?pageId=X`, `?templateId=X` |
| POST | `/api/documents` | Create document |
| PUT | `/api/documents/{id}` | Update document |
| DELETE | `/api/documents/{id}` | Delete document |

### Batch

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/batch` | Upsert `{ pages[], groups[], captures[], templates[], documents[] }` in a single transaction. Used for initial migration from IndexedDB. |

### Cross-Cutting Concerns

- All list endpoints support `?limit=N&offset=N` pagination
- All mutations return the created/updated entity
- CORS headers allow `chrome-extension://` origins (and `moz-extension://` for future Firefox)
- Errors return `{ error: "message" }` with appropriate HTTP status codes

---

## Database Schema

libSQL (SQLite-compatible). All text IDs (UUIDs generated client-side). Timestamps stored as ISO 8601 text.

```sql
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  favicon TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  meta_description TEXT,
  creator TEXT,
  creator_avatar TEXT,
  creator_url TEXT,
  published_at TEXT,
  tags TEXT,                -- JSON array
  notes TEXT,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TEXT,
  captured_at TEXT NOT NULL,
  source_label TEXT,
  device_id TEXT,
  archived INTEGER DEFAULT 0,
  starred INTEGER DEFAULT 0,
  deleted_at TEXT,
  group_id TEXT REFERENCES groups(id),
  content_key TEXT,
  content_type TEXT,        -- 'transcript' | 'markdown'
  content_fetched_at TEXT,
  content_version INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pages_group ON pages(group_id);
CREATE INDEX idx_pages_archived ON pages(archived);
CREATE INDEX idx_pages_starred ON pages(starred);
CREATE INDEX idx_pages_captured ON pages(captured_at);
CREATE INDEX idx_pages_url ON pages(url);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capture_id TEXT REFERENCES captures(id),
  position INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE captures (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  source_label TEXT,
  tab_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_builtin INTEGER DEFAULT 0,
  default_prompt TEXT,
  is_enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  page_id TEXT REFERENCES pages(id),
  template_id TEXT REFERENCES templates(id),
  content TEXT,
  generated_at TEXT,
  prompt_used TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_documents_page ON documents(page_id);
CREATE INDEX idx_documents_template ON documents(template_id);
```

---

## Go Project Structure

```
apps/service/
├── main.go                 # Wails app entry, starts HTTP server + tray
├── go.mod
├── go.sum
├── wails.json              # Wails v3 config
├── build/
│   ├── appicon.png
│   ├── darwin/
│   ├── windows/
│   └── linux/
├── internal/
│   ├── server/
│   │   ├── server.go       # HTTP server setup, CORS, middleware
│   │   └── routes.go       # Route registration
│   ├── handler/
│   │   ├── pages.go
│   │   ├── groups.go
│   │   ├── captures.go
│   │   ├── templates.go
│   │   ├── documents.go
│   │   ├── batch.go
│   │   └── health.go
│   ├── db/
│   │   ├── db.go           # libSQL connection, migrations
│   │   ├── migrations.go   # Schema versioning
│   │   └── queries/        # SQL files (go:embed)
│   │       ├── pages.sql
│   │       ├── groups.sql
│   │       ├── captures.sql
│   │       ├── templates.sql
│   │       └── documents.sql
│   └── model/
│       ├── page.go
│       ├── group.go
│       ├── capture.go
│       ├── template.go
│       ├── document.go
│       └── batch.go
└── frontend/
    ├── index.html
    ├── src/
    │   └── App.tsx
    ├── package.json
    └── vite.config.ts
```

---

## Extension Integration

### New Files

```
apps/extension/lib/
├── adapters/
│   ├── indexeddb-adapter.ts    # Current IndexedDB logic (extracted)
│   └── service-adapter.ts     # HTTP calls to localhost:7824
├── data-layer.ts               # Adapter selection + health check
```

### Adapter Selection

New setting: `dataSource: 'local' | 'service' | 'auto'`

- `local`: Always IndexedDB (current behavior, unchanged)
- `service`: Always localhost API (errors if unavailable)
- `auto` (default): Ping health endpoint on startup. Use service if available, fall back to IndexedDB.

### Migration Flow

When a user first enables the service:
1. Extension reads all data from IndexedDB
2. Posts to `/api/batch` (single transaction upsert)
3. Switches adapter to service
4. IndexedDB is no longer written to (retained as readonly fallback)

Reverse migration (service -> IndexedDB) follows the same pattern via a batch export from the service.

### What Changes in the Extension

- Extract current `db.ts` functions behind adapter interface
- Add `service-adapter.ts` (HTTP client to localhost)
- Add `data-layer.ts` (adapter selection logic)
- Add `dataSource` setting to settings type and UI
- Add migration utility

### What Doesn't Change

- UI components (same function signatures)
- AI logic (reads/writes through adapter)
- Cloudflare sync (remains independent)

---

## Phased Roadmap

### Phase 1 (this implementation)
- Wails v3 app in `apps/service/`
- System tray (status, quit)
- libSQL database with schema + migrations
- REST API: pages, groups, captures, templates, documents, batch, health
- CORS for extension origins
- `LocalServiceAdapter` in extension
- `data-layer.ts` with auto-detection + fallback
- Settings toggle for data source
- One-time IndexedDB-to-service migration

### Phase 2 (future)
- WebSocket push for cross-browser real-time updates
- Chat, conversations, conversation groups
- Embeddings + vector search in libSQL
- Content storage (transcripts, markdown)

### Phase 3 (future)
- Turso embedded replica sync
- Mobile app support via Turso
- Settings UI in the Wails webview
- Auto-updater

### Phase 4 (future)
- Full migration of Cloudflare sync to the service
- Deprecate D1/R2
- Cross-device sync via Turso

---

## Updates to Data Tier Strategy

This design introduces a "Tier 1.5" between Tier 1 (IndexedDB only) and Tier 2 (Turso):

```
Tier 1:   IndexedDB only (current default)
Tier 1.5: Wails local service (experimental) -- local libSQL, localhost API
Tier 2:   Wails service + Turso sync -- embedded replica syncs to cloud, mobile access
Tier 3:   Managed backend (future)
```

The Wails service is the bridge: it starts as a local-only database, and adding Turso credentials later turns it into an embedded replica with zero code changes. Mobile apps connect to the same Turso database.
