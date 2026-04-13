# Wails Local Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Wails v3 desktop app at `apps/service/` that exposes a localhost REST API backed by libSQL, plus a `LocalServiceAdapter` in the extension that routes data operations through it.

**Architecture:** Go backend using `net/http` standard library serves CRUD endpoints on `localhost:7824`. libSQL (via go-libsql) stores all data in a local database file. The extension detects the service via health check and routes operations through a new adapter, falling back to IndexedDB when unavailable.

**Tech Stack:** Go 1.26, Wails v3 (alpha), go-libsql (CGO), net/http, Solid.js (minimal frontend), TypeScript (extension adapter)

**Spec:** `docs/superpowers/specs/2026-04-11-wails-local-service-design.md`

---

## File Structure

### Go Service (`apps/service/`)

```
apps/service/
├── main.go                          # Wails app entry + HTTP server + tray
├── go.mod
├── go.sum
├── wails.json
├── Taskfile.yml
├── build/
│   ├── appicon.png
│   ├── darwin/
│   │   └── Info.plist
│   ├── windows/
│   │   └── info.json
│   └── linux/
│       └── info.json
├── internal/
│   ├── model/
│   │   ├── page.go                  # Page struct
│   │   ├── group.go                 # Group struct
│   │   ├── capture.go               # Capture struct
│   │   ├── template.go              # Template struct
│   │   ├── document.go              # Document struct
│   │   └── batch.go                 # BatchRequest/BatchResponse
│   ├── db/
│   │   ├── db.go                    # Connection, init, close
│   │   ├── db_test.go               # DB init tests
│   │   ├── migrations.go            # Schema creation + versioning
│   │   ├── pages.go                 # Page queries
│   │   ├── pages_test.go
│   │   ├── groups.go                # Group queries
│   │   ├── groups_test.go
│   │   ├── captures.go              # Capture queries
│   │   ├── captures_test.go
│   │   ├── templates.go             # Template queries
│   │   ├── templates_test.go
│   │   ├── documents.go             # Document queries
│   │   ├── documents_test.go
│   │   └── batch.go                 # Batch upsert
│   ├── handler/
│   │   ├── handler.go               # Shared helpers (writeJSON, readJSON, etc.)
│   │   ├── health.go                # GET /api/health
│   │   ├── pages.go                 # Page CRUD handlers
│   │   ├── pages_test.go
│   │   ├── groups.go                # Group CRUD handlers
│   │   ├── groups_test.go
│   │   ├── captures.go              # Capture handlers
│   │   ├── captures_test.go
│   │   ├── templates.go             # Template CRUD handlers
│   │   ├── templates_test.go
│   │   ├── documents.go             # Document CRUD handlers
│   │   ├── documents_test.go
│   │   └── batch.go                 # Batch upsert handler
│   └── server/
│       ├── server.go                # HTTP server setup, CORS
│       └── routes.go                # Route registration
└── frontend/
    ├── index.html
    ├── src/
    │   ├── App.tsx
    │   └── App.module.css
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

### Extension Changes (`apps/extension/`)

```
apps/extension/lib/
├── adapters/
│   ├── types.ts                     # DataAdapter interface
│   ├── indexeddb-adapter.ts         # Wraps existing db.ts
│   └── service-adapter.ts          # HTTP client to localhost:7824
├── data-layer.ts                    # Adapter selection + health check
```

Modified files:
- `apps/extension/lib/types.ts` -- add `dataSource` to Settings
- `apps/extension/lib/settings.ts` -- add default for `dataSource`

---

## Task 1: Scaffold Wails v3 Project

**Files:**
- Create: `apps/service/go.mod`
- Create: `apps/service/main.go`
- Create: `apps/service/wails.json`
- Create: `apps/service/Taskfile.yml`
- Create: `apps/service/build/appicon.png`
- Create: `apps/service/build/darwin/Info.plist`
- Create: `apps/service/frontend/index.html`
- Create: `apps/service/frontend/src/App.tsx`
- Create: `apps/service/frontend/src/App.module.css`
- Create: `apps/service/frontend/package.json`
- Create: `apps/service/frontend/tsconfig.json`
- Create: `apps/service/frontend/vite.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Install Wails v3 CLI**

```bash
go install github.com/wailsapp/wails/v3/cmd/wails3@latest
```

Verify: `wails3 version` should print a v3 alpha version.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p apps/service/{internal/{model,db,handler,server},build/{darwin,windows,linux},frontend/src}
```

- [ ] **Step 3: Initialize Go module**

Create `apps/service/go.mod`:

```go
module tabzen-service

go 1.26

require (
	github.com/tursodatabase/go-libsql v0.0.0-20250401000000-000000000000
	github.com/wailsapp/wails/v3 v3.0.0-alpha.73
)
```

Run from `apps/service/`:

```bash
cd apps/service && go mod tidy
```

This will resolve exact dependency versions. If go-libsql or wails versions differ, `go mod tidy` will find the latest compatible versions.

- [ ] **Step 4: Create minimal main.go**

Create `apps/service/main.go`:

```go
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name:        "TabZen Service",
		Description: "Local data service for Tab Zen",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	systemTray := app.NewSystemTray()
	trayMenu := app.NewMenu()
	trayMenu.Add("TabZen Service Running").SetEnabled(false)
	trayMenu.AddSeparator()
	trayMenu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	systemTray.SetMenu(trayMenu)
	systemTray.SetLabel("TabZen")

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 5: Create Solid.js frontend placeholder**

Create `apps/service/frontend/package.json`:

```json
{
  "name": "tabzen-service-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "solid-js": "^1.9.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-plugin-solid": "^2.11.0"
  }
}
```

Create `apps/service/frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TabZen Service</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/App.tsx"></script>
</body>
</html>
```

Create `apps/service/frontend/src/App.tsx`:

```tsx
import { render } from "solid-js/web";

function App() {
  return (
    <div style={{ padding: "2rem", "font-family": "system-ui, sans-serif" }}>
      <h1>TabZen Service</h1>
      <p>The local service is running. You can close this window — the service continues in the system tray.</p>
    </div>
  );
}

render(() => <App />, document.getElementById("app")!);
```

Create `apps/service/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `apps/service/frontend/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 6: Create build config files**

Create `apps/service/wails.json`:

```json
{
  "$schema": "https://wails.io/schemas/config.v3.json",
  "name": "tabzen-service",
  "outputfilename": "tabzen-service",
  "frontend:install": "pnpm install",
  "frontend:build": "pnpm build",
  "frontend:dir": "frontend",
  "author": {
    "name": "Tab Zen"
  }
}
```

Create a simple `apps/service/build/darwin/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>TabZen Service</string>
    <key>CFBundleIdentifier</key>
    <string>com.tabzen.service</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
```

Note: `LSUIElement=true` hides the app from the Dock (tray-only app).

- [ ] **Step 7: Update .gitignore**

Append to the project root `.gitignore`:

```
# Go
apps/service/bin/
apps/service/build/bin/
*.exe
*.dll
*.dylib
```

- [ ] **Step 8: Build frontend and verify Go compiles**

```bash
cd apps/service/frontend && pnpm install && pnpm build
cd apps/service && go build -o /dev/null .
```

Expected: Both commands succeed without errors. The Go build may show warnings about unused imports which will resolve as we add more code.

- [ ] **Step 9: Commit**

```bash
git add apps/service/ .gitignore
git commit -m "feat(service): scaffold Wails v3 project with Solid.js frontend"
```

---

## Task 2: Go Models and Database Layer

**Files:**
- Create: `apps/service/internal/model/page.go`
- Create: `apps/service/internal/model/group.go`
- Create: `apps/service/internal/model/capture.go`
- Create: `apps/service/internal/model/template.go`
- Create: `apps/service/internal/model/document.go`
- Create: `apps/service/internal/model/batch.go`
- Create: `apps/service/internal/db/db.go`
- Create: `apps/service/internal/db/migrations.go`
- Create: `apps/service/internal/db/db_test.go`

- [ ] **Step 1: Create Page model**

Create `apps/service/internal/model/page.go`:

```go
package model

import (
	"encoding/json"
	"time"
)

type Page struct {
	ID               string   `json:"id"`
	URL              string   `json:"url"`
	Title            string   `json:"title"`
	Favicon          string   `json:"favicon"`
	OgTitle          *string  `json:"ogTitle"`
	OgDescription    *string  `json:"ogDescription"`
	OgImage          *string  `json:"ogImage"`
	MetaDescription  *string  `json:"metaDescription"`
	Creator          *string  `json:"creator"`
	CreatorAvatar    *string  `json:"creatorAvatar"`
	CreatorUrl       *string  `json:"creatorUrl"`
	PublishedAt      *string  `json:"publishedAt"`
	Tags             []string `json:"tags"`
	Notes            *string  `json:"notes"`
	ViewCount        int      `json:"viewCount"`
	LastViewedAt     *string  `json:"lastViewedAt"`
	CapturedAt       string   `json:"capturedAt"`
	SourceLabel      string   `json:"sourceLabel"`
	DeviceID         string   `json:"deviceId"`
	Archived         bool     `json:"archived"`
	Starred          bool     `json:"starred"`
	DeletedAt        *string  `json:"deletedAt"`
	GroupID          string   `json:"groupId"`
	ContentKey       *string  `json:"contentKey"`
	ContentType      *string  `json:"contentType"`
	ContentFetchedAt *string  `json:"contentFetchedAt"`
	ContentVersion   *int     `json:"contentVersion"`
	CreatedAt        string   `json:"createdAt"`
	UpdatedAt        string   `json:"updatedAt"`
}

// TagsJSON returns tags as a JSON string for SQL storage.
func (p *Page) TagsJSON() string {
	if p.Tags == nil {
		return "[]"
	}
	b, _ := json.Marshal(p.Tags)
	return string(b)
}

// ParseTags parses a JSON string into the Tags field.
func (p *Page) ParseTags(s string) {
	if s == "" || s == "null" {
		p.Tags = []string{}
		return
	}
	_ = json.Unmarshal([]byte(s), &p.Tags)
	if p.Tags == nil {
		p.Tags = []string{}
	}
}

// Now returns current time as ISO 8601 string.
func Now() string {
	return time.Now().UTC().Format(time.RFC3339)
}
```

- [ ] **Step 2: Create remaining models**

Create `apps/service/internal/model/group.go`:

```go
package model

type Group struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CaptureID string `json:"captureId"`
	Position  int    `json:"position"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}
```

Create `apps/service/internal/model/capture.go`:

```go
package model

type Capture struct {
	ID          string `json:"id"`
	CapturedAt  string `json:"capturedAt"`
	SourceLabel string `json:"sourceLabel"`
	TabCount    int    `json:"tabCount"`
	CreatedAt   string `json:"createdAt"`
}
```

Create `apps/service/internal/model/template.go`:

```go
package model

type Template struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Prompt        string  `json:"prompt"`
	IsBuiltin     bool    `json:"isBuiltin"`
	DefaultPrompt *string `json:"defaultPrompt"`
	IsEnabled     bool    `json:"isEnabled"`
	SortOrder     int     `json:"sortOrder"`
	Model         *string `json:"model"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
}
```

Create `apps/service/internal/model/document.go`:

```go
package model

type Document struct {
	ID          string  `json:"id"`
	PageID      string  `json:"pageId"`
	TemplateID  string  `json:"templateId"`
	Content     string  `json:"content"`
	GeneratedAt string  `json:"generatedAt"`
	PromptUsed  string  `json:"promptUsed"`
	SourceHash  *string `json:"sourceHash"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}
```

Create `apps/service/internal/model/batch.go`:

```go
package model

type BatchRequest struct {
	Pages     []Page     `json:"pages"`
	Groups    []Group    `json:"groups"`
	Captures  []Capture  `json:"captures"`
	Templates []Template `json:"templates"`
	Documents []Document `json:"documents"`
}

type BatchResponse struct {
	Pages     int `json:"pages"`
	Groups    int `json:"groups"`
	Captures  int `json:"captures"`
	Templates int `json:"templates"`
	Documents int `json:"documents"`
}
```

- [ ] **Step 3: Create database connection manager**

Create `apps/service/internal/db/db.go`:

```go
package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	_ "github.com/tursodatabase/go-libsql"
)

var conn *sql.DB

// Open initializes the database connection. Call once at startup.
func Open() (*sql.DB, error) {
	dbPath, err := dbFilePath()
	if err != nil {
		return nil, fmt.Errorf("db path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("create db dir: %w", err)
	}

	db, err := sql.Open("libsql", "file:"+dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// Enable WAL mode for better concurrent read performance.
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}

	// Enable foreign keys.
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	if err := Migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	conn = db
	return db, nil
}

// OpenTest creates an in-memory database for tests.
func OpenTest() (*sql.DB, error) {
	db, err := sql.Open("libsql", "file::memory:")
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		db.Close()
		return nil, err
	}
	if err := Migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func dbFilePath() (string, error) {
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support", "TabZen", "tabzen.db"), nil
	case "linux":
		dataDir := os.Getenv("XDG_DATA_HOME")
		if dataDir == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			dataDir = filepath.Join(home, ".local", "share")
		}
		return filepath.Join(dataDir, "tabzen", "tabzen.db"), nil
	case "windows":
		appData := os.Getenv("LOCALAPPDATA")
		if appData == "" {
			return "", fmt.Errorf("LOCALAPPDATA not set")
		}
		return filepath.Join(appData, "TabZen", "tabzen.db"), nil
	default:
		return "", fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}
```

- [ ] **Step 4: Create migrations**

Create `apps/service/internal/db/migrations.go`:

```go
package db

import "database/sql"

const schemaVersion = 1

func Migrate(db *sql.DB) error {
	// Create version tracking table.
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`); err != nil {
		return err
	}

	var current int
	err := db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&current)
	if err != nil {
		return err
	}

	if current < 1 {
		if err := migrateV1(db); err != nil {
			return err
		}
	}

	return nil
}

func migrateV1(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE pages (
			id TEXT PRIMARY KEY,
			url TEXT NOT NULL,
			title TEXT DEFAULT '',
			favicon TEXT DEFAULT '',
			og_title TEXT,
			og_description TEXT,
			og_image TEXT,
			meta_description TEXT,
			creator TEXT,
			creator_avatar TEXT,
			creator_url TEXT,
			published_at TEXT,
			tags TEXT DEFAULT '[]',
			notes TEXT,
			view_count INTEGER DEFAULT 0,
			last_viewed_at TEXT,
			captured_at TEXT NOT NULL,
			source_label TEXT DEFAULT '',
			device_id TEXT DEFAULT '',
			archived INTEGER DEFAULT 0,
			starred INTEGER DEFAULT 0,
			deleted_at TEXT,
			group_id TEXT,
			content_key TEXT,
			content_type TEXT,
			content_fetched_at TEXT,
			content_version INTEGER,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE INDEX idx_pages_group ON pages(group_id)`,
		`CREATE INDEX idx_pages_archived ON pages(archived)`,
		`CREATE INDEX idx_pages_starred ON pages(starred)`,
		`CREATE INDEX idx_pages_captured ON pages(captured_at)`,
		`CREATE INDEX idx_pages_url ON pages(url)`,

		`CREATE TABLE groups (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			capture_id TEXT,
			position INTEGER DEFAULT 0,
			archived INTEGER DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE captures (
			id TEXT PRIMARY KEY,
			captured_at TEXT NOT NULL,
			source_label TEXT DEFAULT '',
			tab_count INTEGER DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE templates (
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
		)`,

		`CREATE TABLE documents (
			id TEXT PRIMARY KEY,
			page_id TEXT,
			template_id TEXT,
			content TEXT DEFAULT '',
			generated_at TEXT,
			prompt_used TEXT DEFAULT '',
			source_hash TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE INDEX idx_documents_page ON documents(page_id)`,
		`CREATE INDEX idx_documents_template ON documents(template_id)`,

		`INSERT INTO schema_version (version) VALUES (1)`,
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, stmt := range statements {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}

	return tx.Commit()
}
```

Note: Foreign key constraints on `group_id`, `page_id`, `template_id` are intentionally omitted. The extension creates entities in any order (e.g., pages before groups during batch import), and FK constraints would require strict insertion ordering. Referential integrity is enforced at the application layer.

- [ ] **Step 5: Write DB initialization test**

Create `apps/service/internal/db/db_test.go`:

```go
package db

import (
	"testing"
)

func TestOpenTest(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatalf("OpenTest failed: %v", err)
	}
	defer db.Close()

	// Verify all tables exist.
	tables := []string{"pages", "groups", "captures", "templates", "documents", "schema_version"}
	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}

	// Verify schema version.
	var version int
	if err := db.QueryRow("SELECT MAX(version) FROM schema_version").Scan(&version); err != nil {
		t.Fatalf("schema version query failed: %v", err)
	}
	if version != 1 {
		t.Errorf("expected schema version 1, got %d", version)
	}
}

func TestMigrateIdempotent(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatalf("OpenTest failed: %v", err)
	}
	defer db.Close()

	// Running Migrate again should not error.
	if err := Migrate(db); err != nil {
		t.Fatalf("second Migrate failed: %v", err)
	}
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/service && go test ./internal/db/ -v
```

Expected: Both tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/service/internal/
git commit -m "feat(service): add Go models and database layer with migrations"
```

---

## Task 3: Page Database Operations and Handlers

**Files:**
- Create: `apps/service/internal/db/pages.go`
- Create: `apps/service/internal/db/pages_test.go`
- Create: `apps/service/internal/handler/handler.go`
- Create: `apps/service/internal/handler/pages.go`
- Create: `apps/service/internal/handler/pages_test.go`
- Create: `apps/service/internal/handler/health.go`

- [ ] **Step 1: Create page DB operations**

Create `apps/service/internal/db/pages.go`:

```go
package db

import (
	"database/sql"
	"fmt"
	"strings"

	"tabzen-service/internal/model"
)

type PageFilter struct {
	Archived *bool
	Starred  *bool
	GroupID  *string
	Search   *string
	Limit    int
	Offset   int
}

func ListPages(db *sql.DB, f PageFilter) ([]model.Page, error) {
	query := "SELECT * FROM pages WHERE deleted_at IS NULL"
	args := []any{}

	if f.Archived != nil {
		query += " AND archived = ?"
		args = append(args, boolToInt(*f.Archived))
	}
	if f.Starred != nil {
		query += " AND starred = ?"
		args = append(args, boolToInt(*f.Starred))
	}
	if f.GroupID != nil {
		query += " AND group_id = ?"
		args = append(args, *f.GroupID)
	}
	if f.Search != nil && *f.Search != "" {
		s := *f.Search
		if strings.HasPrefix(s, "#") {
			// Tag search: look inside JSON tags array.
			tag := strings.TrimPrefix(s, "#")
			query += " AND tags LIKE ?"
			args = append(args, fmt.Sprintf("%%%q%%", tag))
		} else {
			query += " AND (title LIKE ? OR url LIKE ? OR notes LIKE ?)"
			like := "%" + s + "%"
			args = append(args, like, like, like)
		}
	}

	query += " ORDER BY captured_at DESC"

	if f.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", f.Limit)
		if f.Offset > 0 {
			query += fmt.Sprintf(" OFFSET %d", f.Offset)
		}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanPages(rows)
}

func GetPage(db *sql.DB, id string) (*model.Page, error) {
	row := db.QueryRow("SELECT * FROM pages WHERE id = ?", id)
	p, err := scanPage(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func InsertPage(db *sql.DB, p *model.Page) error {
	now := model.Now()
	if p.CreatedAt == "" {
		p.CreatedAt = now
	}
	p.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO pages (
		id, url, title, favicon, og_title, og_description, og_image, meta_description,
		creator, creator_avatar, creator_url, published_at, tags, notes,
		view_count, last_viewed_at, captured_at, source_label, device_id,
		archived, starred, deleted_at, group_id,
		content_key, content_type, content_fetched_at, content_version,
		created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		url=excluded.url, title=excluded.title, favicon=excluded.favicon,
		og_title=excluded.og_title, og_description=excluded.og_description,
		og_image=excluded.og_image, meta_description=excluded.meta_description,
		creator=excluded.creator, creator_avatar=excluded.creator_avatar,
		creator_url=excluded.creator_url, published_at=excluded.published_at,
		tags=excluded.tags, notes=excluded.notes, view_count=excluded.view_count,
		last_viewed_at=excluded.last_viewed_at, captured_at=excluded.captured_at,
		source_label=excluded.source_label, device_id=excluded.device_id,
		archived=excluded.archived, starred=excluded.starred, deleted_at=excluded.deleted_at,
		group_id=excluded.group_id, content_key=excluded.content_key,
		content_type=excluded.content_type, content_fetched_at=excluded.content_fetched_at,
		content_version=excluded.content_version, updated_at=excluded.updated_at`,
		p.ID, p.URL, p.Title, p.Favicon, p.OgTitle, p.OgDescription, p.OgImage, p.MetaDescription,
		p.Creator, p.CreatorAvatar, p.CreatorUrl, p.PublishedAt, p.TagsJSON(), p.Notes,
		p.ViewCount, p.LastViewedAt, p.CapturedAt, p.SourceLabel, p.DeviceID,
		boolToInt(p.Archived), boolToInt(p.Starred), p.DeletedAt, p.GroupID,
		p.ContentKey, p.ContentType, p.ContentFetchedAt, p.ContentVersion,
		p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func UpdatePage(db *sql.DB, id string, updates map[string]any) (*model.Page, error) {
	if len(updates) == 0 {
		return GetPage(db, id)
	}

	sets := []string{}
	args := []any{}
	for col, val := range updates {
		sets = append(sets, col+" = ?")
		args = append(args, val)
	}
	sets = append(sets, "updated_at = ?")
	args = append(args, model.Now())
	args = append(args, id)

	query := fmt.Sprintf("UPDATE pages SET %s WHERE id = ?", strings.Join(sets, ", "))
	if _, err := db.Exec(query, args...); err != nil {
		return nil, err
	}

	return GetPage(db, id)
}

func SoftDeletePage(db *sql.DB, id string) error {
	_, err := db.Exec("UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?", model.Now(), model.Now(), id)
	return err
}

// scanPage scans a single row into a Page.
func scanPage(row *sql.Row) (model.Page, error) {
	var p model.Page
	var archived, starred int
	var tagsJSON string

	err := row.Scan(
		&p.ID, &p.URL, &p.Title, &p.Favicon, &p.OgTitle, &p.OgDescription, &p.OgImage, &p.MetaDescription,
		&p.Creator, &p.CreatorAvatar, &p.CreatorUrl, &p.PublishedAt, &tagsJSON, &p.Notes,
		&p.ViewCount, &p.LastViewedAt, &p.CapturedAt, &p.SourceLabel, &p.DeviceID,
		&archived, &starred, &p.DeletedAt, &p.GroupID,
		&p.ContentKey, &p.ContentType, &p.ContentFetchedAt, &p.ContentVersion,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, err
	}
	p.Archived = archived == 1
	p.Starred = starred == 1
	p.ParseTags(tagsJSON)
	return p, nil
}

// scanPages scans multiple rows into Pages.
func scanPages(rows *sql.Rows) ([]model.Page, error) {
	var pages []model.Page
	for rows.Next() {
		var p model.Page
		var archived, starred int
		var tagsJSON string

		err := rows.Scan(
			&p.ID, &p.URL, &p.Title, &p.Favicon, &p.OgTitle, &p.OgDescription, &p.OgImage, &p.MetaDescription,
			&p.Creator, &p.CreatorAvatar, &p.CreatorUrl, &p.PublishedAt, &tagsJSON, &p.Notes,
			&p.ViewCount, &p.LastViewedAt, &p.CapturedAt, &p.SourceLabel, &p.DeviceID,
			&archived, &starred, &p.DeletedAt, &p.GroupID,
			&p.ContentKey, &p.ContentType, &p.ContentFetchedAt, &p.ContentVersion,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		p.Archived = archived == 1
		p.Starred = starred == 1
		p.ParseTags(tagsJSON)
		pages = append(pages, p)
	}
	if pages == nil {
		pages = []model.Page{}
	}
	return pages, rows.Err()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
```

- [ ] **Step 2: Write page DB tests**

Create `apps/service/internal/db/pages_test.go`:

```go
package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func testPage() model.Page {
	return model.Page{
		ID:          "page-1",
		URL:         "https://example.com",
		Title:       "Example",
		Favicon:     "https://example.com/favicon.ico",
		Tags:        []string{"test", "example"},
		CapturedAt:  "2026-04-11T00:00:00Z",
		SourceLabel: "test",
		DeviceID:    "device-1",
		GroupID:     "group-1",
	}
}

func TestInsertAndGetPage(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p := testPage()
	if err := InsertPage(db, &p); err != nil {
		t.Fatalf("InsertPage: %v", err)
	}

	got, err := GetPage(db, "page-1")
	if err != nil {
		t.Fatalf("GetPage: %v", err)
	}
	if got == nil {
		t.Fatal("GetPage returned nil")
	}
	if got.URL != "https://example.com" {
		t.Errorf("URL = %q, want %q", got.URL, "https://example.com")
	}
	if len(got.Tags) != 2 || got.Tags[0] != "test" {
		t.Errorf("Tags = %v, want [test example]", got.Tags)
	}
}

func TestListPages(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p1 := testPage()
	p2 := testPage()
	p2.ID = "page-2"
	p2.URL = "https://other.com"
	p2.Title = "Other"
	p2.Starred = true
	InsertPage(db, &p1)
	InsertPage(db, &p2)

	// List all.
	pages, err := ListPages(db, PageFilter{})
	if err != nil {
		t.Fatalf("ListPages: %v", err)
	}
	if len(pages) != 2 {
		t.Errorf("len = %d, want 2", len(pages))
	}

	// Filter starred.
	starred := true
	pages, err = ListPages(db, PageFilter{Starred: &starred})
	if err != nil {
		t.Fatalf("ListPages starred: %v", err)
	}
	if len(pages) != 1 || pages[0].ID != "page-2" {
		t.Errorf("starred filter: got %d pages", len(pages))
	}
}

func TestSoftDeletePage(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p := testPage()
	InsertPage(db, &p)
	SoftDeletePage(db, "page-1")

	// Should not appear in list (deleted_at IS NULL filter).
	pages, _ := ListPages(db, PageFilter{})
	if len(pages) != 0 {
		t.Errorf("expected 0 pages after soft delete, got %d", len(pages))
	}

	// But should still be gettable directly.
	got, _ := GetPage(db, "page-1")
	if got == nil || got.DeletedAt == nil {
		t.Error("soft-deleted page should still exist with deletedAt set")
	}
}

func TestSearchPages(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p := testPage()
	p.Title = "Golang Tutorial"
	InsertPage(db, &p)

	search := "golang"
	pages, err := ListPages(db, PageFilter{Search: &search})
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(pages) != 1 {
		t.Errorf("search: got %d, want 1", len(pages))
	}
}

func TestUpdatePage(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p := testPage()
	InsertPage(db, &p)

	updated, err := UpdatePage(db, "page-1", map[string]any{"title": "Updated Title", "starred": 1})
	if err != nil {
		t.Fatalf("UpdatePage: %v", err)
	}
	if updated.Title != "Updated Title" {
		t.Errorf("title = %q, want %q", updated.Title, "Updated Title")
	}
	if !updated.Starred {
		t.Error("expected starred = true")
	}
}
```

- [ ] **Step 3: Run page DB tests**

```bash
cd apps/service && go test ./internal/db/ -v -run TestInsert\|TestList\|TestSoft\|TestSearch\|TestUpdate
```

Expected: All tests pass.

- [ ] **Step 4: Create shared handler helpers**

Create `apps/service/internal/handler/handler.go`:

```go
package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
)

// Handlers holds the database connection shared by all handlers.
type Handlers struct {
	DB *sql.DB
}

func New(db *sql.DB) *Handlers {
	return &Handlers{DB: db}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func queryInt(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func queryString(r *http.Request, key string) *string {
	s := r.URL.Query().Get(key)
	if s == "" {
		return nil
	}
	return &s
}

func queryBool(r *http.Request, key string) *bool {
	s := r.URL.Query().Get(key)
	if s == "" {
		return nil
	}
	b := s == "true" || s == "1"
	return &b
}
```

- [ ] **Step 5: Create health handler**

Create `apps/service/internal/handler/health.go`:

```go
package handler

import "net/http"

const Version = "0.1.0"

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"version": Version,
	})
}
```

- [ ] **Step 6: Create page handlers**

Create `apps/service/internal/handler/pages.go`:

```go
package handler

import (
	"encoding/json"
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListPages(w http.ResponseWriter, r *http.Request) {
	filter := db.PageFilter{
		Archived: queryBool(r, "archived"),
		Starred:  queryBool(r, "starred"),
		GroupID:  queryString(r, "groupId"),
		Search:   queryString(r, "search"),
		Limit:    queryInt(r, "limit", 0),
		Offset:   queryInt(r, "offset", 0),
	}

	pages, err := db.ListPages(h.DB, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pages)
}

func (h *Handlers) GetPage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	page, err := db.GetPage(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if page == nil {
		writeError(w, http.StatusNotFound, "page not found")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handlers) CreatePage(w http.ResponseWriter, r *http.Request) {
	// Detect if array or single object.
	var raw json.RawMessage
	if err := readJSON(r, &raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	if len(raw) > 0 && raw[0] == '[' {
		var pages []model.Page
		if err := json.Unmarshal(raw, &pages); err != nil {
			writeError(w, http.StatusBadRequest, "invalid page array")
			return
		}
		for i := range pages {
			if err := db.InsertPage(h.DB, &pages[i]); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}
		writeJSON(w, http.StatusCreated, pages)
	} else {
		var page model.Page
		if err := json.Unmarshal(raw, &page); err != nil {
			writeError(w, http.StatusBadRequest, "invalid page")
			return
		}
		if err := db.InsertPage(h.DB, &page); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, page)
	}
}

func (h *Handlers) UpdatePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Map camelCase JSON keys to snake_case DB columns.
	updates := mapPageUpdates(body)

	page, err := db.UpdatePage(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if page == nil {
		writeError(w, http.StatusNotFound, "page not found")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handlers) DeletePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.SoftDeletePage(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

// mapPageUpdates converts camelCase JSON keys to snake_case column names.
var pageKeyMap = map[string]string{
	"url": "url", "title": "title", "favicon": "favicon",
	"ogTitle": "og_title", "ogDescription": "og_description", "ogImage": "og_image",
	"metaDescription": "meta_description", "creator": "creator",
	"creatorAvatar": "creator_avatar", "creatorUrl": "creator_url",
	"publishedAt": "published_at", "notes": "notes",
	"viewCount": "view_count", "lastViewedAt": "last_viewed_at",
	"sourceLabel": "source_label", "deviceId": "device_id",
	"archived": "archived", "starred": "starred",
	"groupId": "group_id", "contentKey": "content_key",
	"contentType": "content_type", "contentFetchedAt": "content_fetched_at",
	"contentVersion": "content_version",
}

func mapPageUpdates(body map[string]any) map[string]any {
	updates := map[string]any{}
	for jsonKey, dbCol := range pageKeyMap {
		if val, ok := body[jsonKey]; ok {
			// Convert booleans to int for SQLite.
			switch dbCol {
			case "archived", "starred":
				if b, ok := val.(bool); ok {
					updates[dbCol] = boolToInt(b)
				}
			default:
				updates[dbCol] = val
			}
		}
	}
	// Handle tags specially (JSON encode).
	if tags, ok := body["tags"]; ok {
		if tagArr, ok := tags.([]any); ok {
			b, _ := json.Marshal(tagArr)
			updates["tags"] = string(b)
		}
	}
	return updates
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
```

- [ ] **Step 7: Write page handler tests**

Create `apps/service/internal/handler/pages_test.go`:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func setupTest(t *testing.T) *Handlers {
	t.Helper()
	database, err := db.OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	return New(database)
}

func TestHealthEndpoint(t *testing.T) {
	h := setupTest(t)
	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	if w.Code != 200 {
		t.Errorf("status = %d, want 200", w.Code)
	}

	var body map[string]string
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["status"] != "ok" {
		t.Errorf("status = %q, want %q", body["status"], "ok")
	}
}

func TestCreateAndListPages(t *testing.T) {
	h := setupTest(t)

	// Create a page.
	page := model.Page{
		ID: "p1", URL: "https://example.com", Title: "Example",
		CapturedAt: "2026-04-11T00:00:00Z", Tags: []string{"test"},
	}
	body, _ := json.Marshal(page)
	req := httptest.NewRequest("POST", "/api/pages", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePage(w, req)

	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	// List pages.
	req = httptest.NewRequest("GET", "/api/pages", nil)
	w = httptest.NewRecorder()
	h.ListPages(w, req)

	var pages []model.Page
	json.Unmarshal(w.Body.Bytes(), &pages)
	if len(pages) != 1 {
		t.Errorf("list: got %d pages, want 1", len(pages))
	}
	if pages[0].Tags[0] != "test" {
		t.Errorf("tags = %v, want [test]", pages[0].Tags)
	}
}

func TestGetPage(t *testing.T) {
	h := setupTest(t)

	page := model.Page{ID: "p1", URL: "https://example.com", CapturedAt: "2026-04-11T00:00:00Z", Tags: []string{}}
	db.InsertPage(h.DB, &page)

	// Use a mux to parse path values.
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)

	req := httptest.NewRequest("GET", "/api/pages/p1", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
	}

	var got model.Page
	json.Unmarshal(w.Body.Bytes(), &got)
	if got.ID != "p1" {
		t.Errorf("id = %q, want %q", got.ID, "p1")
	}
}

func TestGetPageNotFound(t *testing.T) {
	h := setupTest(t)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)

	req := httptest.NewRequest("GET", "/api/pages/nonexistent", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 404 {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestDeletePage(t *testing.T) {
	h := setupTest(t)

	page := model.Page{ID: "p1", URL: "https://example.com", CapturedAt: "2026-04-11T00:00:00Z", Tags: []string{}}
	db.InsertPage(h.DB, &page)

	mux := http.NewServeMux()
	mux.HandleFunc("DELETE /api/pages/{id}", h.DeletePage)

	req := httptest.NewRequest("DELETE", "/api/pages/p1", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("delete status = %d", w.Code)
	}

	// Should not appear in list.
	req = httptest.NewRequest("GET", "/api/pages", nil)
	w = httptest.NewRecorder()
	h.ListPages(w, req)

	var pages []model.Page
	json.Unmarshal(w.Body.Bytes(), &pages)
	if len(pages) != 0 {
		t.Errorf("expected 0 pages after delete, got %d", len(pages))
	}
}
```

- [ ] **Step 8: Run all tests**

```bash
cd apps/service && go test ./... -v
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/service/internal/
git commit -m "feat(service): add page CRUD operations and HTTP handlers with tests"
```

---

## Task 4: Group and Capture DB Operations and Handlers

**Files:**
- Create: `apps/service/internal/db/groups.go`
- Create: `apps/service/internal/db/groups_test.go`
- Create: `apps/service/internal/db/captures.go`
- Create: `apps/service/internal/db/captures_test.go`
- Create: `apps/service/internal/handler/groups.go`
- Create: `apps/service/internal/handler/groups_test.go`
- Create: `apps/service/internal/handler/captures.go`
- Create: `apps/service/internal/handler/captures_test.go`

- [ ] **Step 1: Create group DB operations**

Create `apps/service/internal/db/groups.go`:

```go
package db

import (
	"database/sql"

	"tabzen-service/internal/model"
)

func ListGroups(db *sql.DB) ([]model.Group, error) {
	rows, err := db.Query("SELECT id, name, capture_id, position, archived, created_at, updated_at FROM groups ORDER BY position ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []model.Group
	for rows.Next() {
		var g model.Group
		var archived int
		if err := rows.Scan(&g.ID, &g.Name, &g.CaptureID, &g.Position, &archived, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		g.Archived = archived == 1
		groups = append(groups, g)
	}
	if groups == nil {
		groups = []model.Group{}
	}
	return groups, rows.Err()
}

func GetGroup(db *sql.DB, id string) (*model.Group, error) {
	var g model.Group
	var archived int
	err := db.QueryRow("SELECT id, name, capture_id, position, archived, created_at, updated_at FROM groups WHERE id = ?", id).
		Scan(&g.ID, &g.Name, &g.CaptureID, &g.Position, &archived, &g.CreatedAt, &g.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	g.Archived = archived == 1
	return &g, nil
}

func InsertGroup(db *sql.DB, g *model.Group) error {
	now := model.Now()
	if g.CreatedAt == "" {
		g.CreatedAt = now
	}
	g.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO groups (id, name, capture_id, position, archived, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, capture_id=excluded.capture_id, position=excluded.position,
			archived=excluded.archived, updated_at=excluded.updated_at`,
		g.ID, g.Name, g.CaptureID, g.Position, boolToInt(g.Archived), g.CreatedAt, g.UpdatedAt,
	)
	return err
}

func UpdateGroup(db *sql.DB, id string, updates map[string]any) (*model.Group, error) {
	if len(updates) == 0 {
		return GetGroup(db, id)
	}

	sets, args := buildUpdateSets(updates)
	args = append(args, id)
	if _, err := db.Exec("UPDATE groups SET "+sets+", updated_at = '"+model.Now()+"' WHERE id = ?", args...); err != nil {
		return nil, err
	}
	return GetGroup(db, id)
}

func DeleteGroup(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM groups WHERE id = ?", id)
	return err
}
```

- [ ] **Step 2: Create capture DB operations**

Create `apps/service/internal/db/captures.go`:

```go
package db

import (
	"database/sql"

	"tabzen-service/internal/model"
)

func ListCaptures(db *sql.DB) ([]model.Capture, error) {
	rows, err := db.Query("SELECT id, captured_at, source_label, tab_count, created_at FROM captures ORDER BY captured_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var captures []model.Capture
	for rows.Next() {
		var c model.Capture
		if err := rows.Scan(&c.ID, &c.CapturedAt, &c.SourceLabel, &c.TabCount, &c.CreatedAt); err != nil {
			return nil, err
		}
		captures = append(captures, c)
	}
	if captures == nil {
		captures = []model.Capture{}
	}
	return captures, rows.Err()
}

func InsertCapture(db *sql.DB, c *model.Capture) error {
	now := model.Now()
	if c.CreatedAt == "" {
		c.CreatedAt = now
	}

	_, err := db.Exec(`INSERT INTO captures (id, captured_at, source_label, tab_count, created_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			captured_at=excluded.captured_at, source_label=excluded.source_label, tab_count=excluded.tab_count`,
		c.ID, c.CapturedAt, c.SourceLabel, c.TabCount, c.CreatedAt,
	)
	return err
}
```

- [ ] **Step 3: Add shared update helper to db package**

Add to the bottom of `apps/service/internal/db/pages.go` (or create a `helpers.go`):

```go
// buildUpdateSets creates "col1 = ?, col2 = ?" and args from a map.
func buildUpdateSets(updates map[string]any) (string, []any) {
	sets := []string{}
	args := []any{}
	for col, val := range updates {
		sets = append(sets, col+" = ?")
		args = append(args, val)
	}
	return strings.Join(sets, ", "), args
}
```

Note: This function is already implicitly used in `UpdatePage`. Refactor `UpdatePage` to use it too, or extract it to a shared file. The implementing agent should keep this DRY.

- [ ] **Step 4: Write group and capture DB tests**

Create `apps/service/internal/db/groups_test.go`:

```go
package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListGroups(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	g := model.Group{ID: "g1", Name: "Work", CaptureID: "c1", Position: 0}
	if err := InsertGroup(db, &g); err != nil {
		t.Fatalf("InsertGroup: %v", err)
	}

	groups, err := ListGroups(db)
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(groups) != 1 || groups[0].Name != "Work" {
		t.Errorf("got %v", groups)
	}
}

func TestDeleteGroup(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	g := model.Group{ID: "g1", Name: "Work", CaptureID: "c1"}
	InsertGroup(db, &g)
	DeleteGroup(db, "g1")

	groups, _ := ListGroups(db)
	if len(groups) != 0 {
		t.Errorf("expected 0 groups, got %d", len(groups))
	}
}
```

Create `apps/service/internal/db/captures_test.go`:

```go
package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListCaptures(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	c := model.Capture{ID: "c1", CapturedAt: "2026-04-11T00:00:00Z", SourceLabel: "test", TabCount: 5}
	if err := InsertCapture(db, &c); err != nil {
		t.Fatalf("InsertCapture: %v", err)
	}

	captures, err := ListCaptures(db)
	if err != nil {
		t.Fatalf("ListCaptures: %v", err)
	}
	if len(captures) != 1 || captures[0].TabCount != 5 {
		t.Errorf("got %v", captures)
	}
}
```

- [ ] **Step 5: Create group and capture handlers**

Create `apps/service/internal/handler/groups.go`:

```go
package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := db.ListGroups(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, groups)
}

func (h *Handlers) GetGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	group, err := db.GetGroup(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if group == nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (h *Handlers) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var group model.Group
	if err := readJSON(r, &group); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := db.InsertGroup(h.DB, &group); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, group)
}

func (h *Handlers) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	updates := mapGroupUpdates(body)
	group, err := db.UpdateGroup(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if group == nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (h *Handlers) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteGroup(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

var groupKeyMap = map[string]string{
	"name": "name", "captureId": "capture_id", "position": "position", "archived": "archived",
}

func mapGroupUpdates(body map[string]any) map[string]any {
	updates := map[string]any{}
	for jsonKey, dbCol := range groupKeyMap {
		if val, ok := body[jsonKey]; ok {
			if dbCol == "archived" {
				if b, ok := val.(bool); ok {
					updates[dbCol] = boolToInt(b)
				}
			} else {
				updates[dbCol] = val
			}
		}
	}
	return updates
}
```

Create `apps/service/internal/handler/captures.go`:

```go
package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListCaptures(w http.ResponseWriter, r *http.Request) {
	captures, err := db.ListCaptures(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, captures)
}

func (h *Handlers) CreateCapture(w http.ResponseWriter, r *http.Request) {
	var capture model.Capture
	if err := readJSON(r, &capture); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := db.InsertCapture(h.DB, &capture); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, capture)
}
```

- [ ] **Step 6: Write handler tests for groups and captures**

Create `apps/service/internal/handler/groups_test.go`:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListGroups(t *testing.T) {
	h := setupTest(t)

	group := model.Group{ID: "g1", Name: "Work", CaptureID: "c1", Position: 0}
	body, _ := json.Marshal(group)
	req := httptest.NewRequest("POST", "/api/groups", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateGroup(w, req)

	if w.Code != 201 {
		t.Fatalf("create status = %d, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest("GET", "/api/groups", nil)
	w = httptest.NewRecorder()
	h.ListGroups(w, req)

	var groups []model.Group
	json.Unmarshal(w.Body.Bytes(), &groups)
	if len(groups) != 1 || groups[0].Name != "Work" {
		t.Errorf("got %v", groups)
	}
}
```

Create `apps/service/internal/handler/captures_test.go`:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListCaptures(t *testing.T) {
	h := setupTest(t)

	capture := model.Capture{ID: "c1", CapturedAt: "2026-04-11T00:00:00Z", SourceLabel: "test", TabCount: 3}
	body, _ := json.Marshal(capture)
	req := httptest.NewRequest("POST", "/api/captures", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateCapture(w, req)

	if w.Code != 201 {
		t.Fatalf("create status = %d, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest("GET", "/api/captures", nil)
	w = httptest.NewRecorder()
	h.ListCaptures(w, req)

	var captures []model.Capture
	json.Unmarshal(w.Body.Bytes(), &captures)
	if len(captures) != 1 || captures[0].TabCount != 3 {
		t.Errorf("got %v", captures)
	}
}
```

- [ ] **Step 7: Run all tests**

```bash
cd apps/service && go test ./... -v
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/service/internal/
git commit -m "feat(service): add group and capture CRUD operations and handlers"
```

---

## Task 5: Template and Document DB Operations and Handlers

**Files:**
- Create: `apps/service/internal/db/templates.go`
- Create: `apps/service/internal/db/templates_test.go`
- Create: `apps/service/internal/db/documents.go`
- Create: `apps/service/internal/db/documents_test.go`
- Create: `apps/service/internal/handler/templates.go`
- Create: `apps/service/internal/handler/templates_test.go`
- Create: `apps/service/internal/handler/documents.go`
- Create: `apps/service/internal/handler/documents_test.go`

- [ ] **Step 1: Create template DB operations**

Create `apps/service/internal/db/templates.go`:

```go
package db

import (
	"database/sql"

	"tabzen-service/internal/model"
)

func ListTemplates(db *sql.DB) ([]model.Template, error) {
	rows, err := db.Query("SELECT id, name, prompt, is_builtin, default_prompt, is_enabled, sort_order, model, created_at, updated_at FROM templates ORDER BY sort_order ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []model.Template
	for rows.Next() {
		var tmpl model.Template
		var isBuiltin, isEnabled int
		if err := rows.Scan(&tmpl.ID, &tmpl.Name, &tmpl.Prompt, &isBuiltin, &tmpl.DefaultPrompt, &isEnabled, &tmpl.SortOrder, &tmpl.Model, &tmpl.CreatedAt, &tmpl.UpdatedAt); err != nil {
			return nil, err
		}
		tmpl.IsBuiltin = isBuiltin == 1
		tmpl.IsEnabled = isEnabled == 1
		templates = append(templates, tmpl)
	}
	if templates == nil {
		templates = []model.Template{}
	}
	return templates, rows.Err()
}

func GetTemplate(db *sql.DB, id string) (*model.Template, error) {
	var tmpl model.Template
	var isBuiltin, isEnabled int
	err := db.QueryRow("SELECT id, name, prompt, is_builtin, default_prompt, is_enabled, sort_order, model, created_at, updated_at FROM templates WHERE id = ?", id).
		Scan(&tmpl.ID, &tmpl.Name, &tmpl.Prompt, &isBuiltin, &tmpl.DefaultPrompt, &isEnabled, &tmpl.SortOrder, &tmpl.Model, &tmpl.CreatedAt, &tmpl.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	tmpl.IsBuiltin = isBuiltin == 1
	tmpl.IsEnabled = isEnabled == 1
	return &tmpl, nil
}

func InsertTemplate(db *sql.DB, tmpl *model.Template) error {
	now := model.Now()
	if tmpl.CreatedAt == "" {
		tmpl.CreatedAt = now
	}
	tmpl.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO templates (id, name, prompt, is_builtin, default_prompt, is_enabled, sort_order, model, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, prompt=excluded.prompt, is_builtin=excluded.is_builtin,
			default_prompt=excluded.default_prompt, is_enabled=excluded.is_enabled,
			sort_order=excluded.sort_order, model=excluded.model, updated_at=excluded.updated_at`,
		tmpl.ID, tmpl.Name, tmpl.Prompt, boolToInt(tmpl.IsBuiltin), tmpl.DefaultPrompt,
		boolToInt(tmpl.IsEnabled), tmpl.SortOrder, tmpl.Model, tmpl.CreatedAt, tmpl.UpdatedAt,
	)
	return err
}

func UpdateTemplate(db *sql.DB, id string, updates map[string]any) (*model.Template, error) {
	if len(updates) == 0 {
		return GetTemplate(db, id)
	}
	sets, args := buildUpdateSets(updates)
	args = append(args, id)
	if _, err := db.Exec("UPDATE templates SET "+sets+", updated_at = '"+model.Now()+"' WHERE id = ?", args...); err != nil {
		return nil, err
	}
	return GetTemplate(db, id)
}

func DeleteTemplate(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM templates WHERE id = ?", id)
	return err
}
```

- [ ] **Step 2: Create document DB operations**

Create `apps/service/internal/db/documents.go`:

```go
package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

type DocumentFilter struct {
	PageID     *string
	TemplateID *string
	Limit      int
	Offset     int
}

func ListDocuments(db *sql.DB, f DocumentFilter) ([]model.Document, error) {
	query := "SELECT id, page_id, template_id, content, generated_at, prompt_used, source_hash, created_at, updated_at FROM documents WHERE 1=1"
	args := []any{}

	if f.PageID != nil {
		query += " AND page_id = ?"
		args = append(args, *f.PageID)
	}
	if f.TemplateID != nil {
		query += " AND template_id = ?"
		args = append(args, *f.TemplateID)
	}

	query += " ORDER BY created_at DESC"

	if f.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", f.Limit)
		if f.Offset > 0 {
			query += fmt.Sprintf(" OFFSET %d", f.Offset)
		}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []model.Document
	for rows.Next() {
		var d model.Document
		if err := rows.Scan(&d.ID, &d.PageID, &d.TemplateID, &d.Content, &d.GeneratedAt, &d.PromptUsed, &d.SourceHash, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	if docs == nil {
		docs = []model.Document{}
	}
	return docs, rows.Err()
}

func GetDocument(db *sql.DB, id string) (*model.Document, error) {
	var d model.Document
	err := db.QueryRow("SELECT id, page_id, template_id, content, generated_at, prompt_used, source_hash, created_at, updated_at FROM documents WHERE id = ?", id).
		Scan(&d.ID, &d.PageID, &d.TemplateID, &d.Content, &d.GeneratedAt, &d.PromptUsed, &d.SourceHash, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func InsertDocument(db *sql.DB, d *model.Document) error {
	now := model.Now()
	if d.CreatedAt == "" {
		d.CreatedAt = now
	}
	d.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO documents (id, page_id, template_id, content, generated_at, prompt_used, source_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			page_id=excluded.page_id, template_id=excluded.template_id, content=excluded.content,
			generated_at=excluded.generated_at, prompt_used=excluded.prompt_used,
			source_hash=excluded.source_hash, updated_at=excluded.updated_at`,
		d.ID, d.PageID, d.TemplateID, d.Content, d.GeneratedAt, d.PromptUsed, d.SourceHash, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

func UpdateDocument(db *sql.DB, id string, updates map[string]any) (*model.Document, error) {
	if len(updates) == 0 {
		return GetDocument(db, id)
	}
	sets, args := buildUpdateSets(updates)
	args = append(args, id)
	if _, err := db.Exec("UPDATE documents SET "+sets+", updated_at = '"+model.Now()+"' WHERE id = ?", args...); err != nil {
		return nil, err
	}
	return GetDocument(db, id)
}

func DeleteDocument(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM documents WHERE id = ?", id)
	return err
}
```

- [ ] **Step 3: Write DB tests for templates and documents**

Create `apps/service/internal/db/templates_test.go`:

```go
package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListTemplates(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	tmpl := model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize this", IsEnabled: true, SortOrder: 1}
	if err := InsertTemplate(db, &tmpl); err != nil {
		t.Fatalf("InsertTemplate: %v", err)
	}

	templates, err := ListTemplates(db)
	if err != nil {
		t.Fatalf("ListTemplates: %v", err)
	}
	if len(templates) != 1 || templates[0].Name != "Summary" {
		t.Errorf("got %v", templates)
	}
	if !templates[0].IsEnabled {
		t.Error("expected IsEnabled = true")
	}
}

func TestDeleteTemplate(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	tmpl := model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize", IsEnabled: true}
	InsertTemplate(db, &tmpl)
	DeleteTemplate(db, "t1")

	templates, _ := ListTemplates(db)
	if len(templates) != 0 {
		t.Errorf("expected 0, got %d", len(templates))
	}
}
```

Create `apps/service/internal/db/documents_test.go`:

```go
package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListDocuments(t *testing.T) {
	db, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	doc := model.Document{ID: "d1", PageID: "p1", TemplateID: "t1", Content: "Summary of page", GeneratedAt: "2026-04-11T00:00:00Z", PromptUsed: "Summarize"}
	if err := InsertDocument(db, &doc); err != nil {
		t.Fatalf("InsertDocument: %v", err)
	}

	// List all.
	docs, err := ListDocuments(db, DocumentFilter{})
	if err != nil {
		t.Fatalf("ListDocuments: %v", err)
	}
	if len(docs) != 1 {
		t.Errorf("got %d docs", len(docs))
	}

	// Filter by pageId.
	pageID := "p1"
	docs, err = ListDocuments(db, DocumentFilter{PageID: &pageID})
	if err != nil {
		t.Fatalf("filter: %v", err)
	}
	if len(docs) != 1 {
		t.Errorf("filtered: got %d", len(docs))
	}

	// Filter by wrong pageId.
	wrongID := "p999"
	docs, _ = ListDocuments(db, DocumentFilter{PageID: &wrongID})
	if len(docs) != 0 {
		t.Errorf("wrong filter: got %d", len(docs))
	}
}
```

- [ ] **Step 4: Create template and document handlers**

Create `apps/service/internal/handler/templates.go`:

```go
package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := db.ListTemplates(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (h *Handlers) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tmpl, err := db.GetTemplate(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tmpl == nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

func (h *Handlers) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var tmpl model.Template
	if err := readJSON(r, &tmpl); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := db.InsertTemplate(h.DB, &tmpl); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tmpl)
}

func (h *Handlers) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	updates := mapTemplateUpdates(body)
	tmpl, err := db.UpdateTemplate(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tmpl == nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

func (h *Handlers) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteTemplate(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

var templateKeyMap = map[string]string{
	"name": "name", "prompt": "prompt", "isBuiltin": "is_builtin",
	"defaultPrompt": "default_prompt", "isEnabled": "is_enabled",
	"sortOrder": "sort_order", "model": "model",
}

func mapTemplateUpdates(body map[string]any) map[string]any {
	updates := map[string]any{}
	for jsonKey, dbCol := range templateKeyMap {
		if val, ok := body[jsonKey]; ok {
			switch dbCol {
			case "is_builtin", "is_enabled":
				if b, ok := val.(bool); ok {
					updates[dbCol] = boolToInt(b)
				}
			default:
				updates[dbCol] = val
			}
		}
	}
	return updates
}
```

Create `apps/service/internal/handler/documents.go`:

```go
package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListDocuments(w http.ResponseWriter, r *http.Request) {
	filter := db.DocumentFilter{
		PageID:     queryString(r, "pageId"),
		TemplateID: queryString(r, "templateId"),
		Limit:      queryInt(r, "limit", 0),
		Offset:     queryInt(r, "offset", 0),
	}

	docs, err := db.ListDocuments(h.DB, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, docs)
}

func (h *Handlers) GetDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := db.GetDocument(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if doc == nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *Handlers) CreateDocument(w http.ResponseWriter, r *http.Request) {
	var doc model.Document
	if err := readJSON(r, &doc); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := db.InsertDocument(h.DB, &doc); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, doc)
}

func (h *Handlers) UpdateDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	updates := mapDocumentUpdates(body)
	doc, err := db.UpdateDocument(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if doc == nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *Handlers) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteDocument(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

var documentKeyMap = map[string]string{
	"pageId": "page_id", "templateId": "template_id", "content": "content",
	"generatedAt": "generated_at", "promptUsed": "prompt_used", "sourceHash": "source_hash",
}

func mapDocumentUpdates(body map[string]any) map[string]any {
	updates := map[string]any{}
	for jsonKey, dbCol := range documentKeyMap {
		if val, ok := body[jsonKey]; ok {
			updates[dbCol] = val
		}
	}
	return updates
}
```

- [ ] **Step 5: Write handler tests**

Create `apps/service/internal/handler/templates_test.go`:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListTemplates(t *testing.T) {
	h := setupTest(t)

	tmpl := model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize this", IsEnabled: true, SortOrder: 1}
	body, _ := json.Marshal(tmpl)
	req := httptest.NewRequest("POST", "/api/templates", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateTemplate(w, req)

	if w.Code != 201 {
		t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest("GET", "/api/templates", nil)
	w = httptest.NewRecorder()
	h.ListTemplates(w, req)

	var templates []model.Template
	json.Unmarshal(w.Body.Bytes(), &templates)
	if len(templates) != 1 || templates[0].Name != "Summary" {
		t.Errorf("got %v", templates)
	}
}
```

Create `apps/service/internal/handler/documents_test.go`:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListDocuments(t *testing.T) {
	h := setupTest(t)

	doc := model.Document{ID: "d1", PageID: "p1", TemplateID: "t1", Content: "A summary", GeneratedAt: "2026-04-11T00:00:00Z", PromptUsed: "Summarize"}
	body, _ := json.Marshal(doc)
	req := httptest.NewRequest("POST", "/api/documents", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateDocument(w, req)

	if w.Code != 201 {
		t.Fatalf("status = %d, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest("GET", "/api/documents?pageId=p1", nil)
	w = httptest.NewRecorder()
	h.ListDocuments(w, req)

	var docs []model.Document
	json.Unmarshal(w.Body.Bytes(), &docs)
	if len(docs) != 1 {
		t.Errorf("got %d docs", len(docs))
	}
}
```

- [ ] **Step 6: Run all tests**

```bash
cd apps/service && go test ./... -v
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/service/internal/
git commit -m "feat(service): add template and document CRUD operations and handlers"
```

---

## Task 6: Batch Handler, Server Wiring, and System Tray

**Files:**
- Create: `apps/service/internal/db/batch.go`
- Create: `apps/service/internal/handler/batch.go`
- Create: `apps/service/internal/server/server.go`
- Create: `apps/service/internal/server/routes.go`
- Modify: `apps/service/main.go`

- [ ] **Step 1: Create batch DB operation**

Create `apps/service/internal/db/batch.go`:

```go
package db

import (
	"database/sql"

	"tabzen-service/internal/model"
)

func BatchUpsert(db *sql.DB, req model.BatchRequest) (model.BatchResponse, error) {
	tx, err := db.Begin()
	if err != nil {
		return model.BatchResponse{}, err
	}
	defer tx.Rollback()

	// We need to use the tx for all inserts. Wrap the connection temporarily.
	// Since our Insert functions take *sql.DB, we'll use a transaction-aware approach.
	resp := model.BatchResponse{}

	for i := range req.Groups {
		g := &req.Groups[i]
		now := model.Now()
		if g.CreatedAt == "" {
			g.CreatedAt = now
		}
		g.UpdatedAt = now
		if _, err := tx.Exec(`INSERT INTO groups (id, name, capture_id, position, archived, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, capture_id=excluded.capture_id, position=excluded.position,
			archived=excluded.archived, updated_at=excluded.updated_at`,
			g.ID, g.Name, g.CaptureID, g.Position, boolToInt(g.Archived), g.CreatedAt, g.UpdatedAt); err != nil {
			return resp, err
		}
		resp.Groups++
	}

	for i := range req.Captures {
		c := &req.Captures[i]
		now := model.Now()
		if c.CreatedAt == "" {
			c.CreatedAt = now
		}
		if _, err := tx.Exec(`INSERT INTO captures (id, captured_at, source_label, tab_count, created_at)
			VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
			captured_at=excluded.captured_at, source_label=excluded.source_label, tab_count=excluded.tab_count`,
			c.ID, c.CapturedAt, c.SourceLabel, c.TabCount, c.CreatedAt); err != nil {
			return resp, err
		}
		resp.Captures++
	}

	for i := range req.Pages {
		p := &req.Pages[i]
		now := model.Now()
		if p.CreatedAt == "" {
			p.CreatedAt = now
		}
		p.UpdatedAt = now
		if _, err := tx.Exec(`INSERT INTO pages (
			id, url, title, favicon, og_title, og_description, og_image, meta_description,
			creator, creator_avatar, creator_url, published_at, tags, notes,
			view_count, last_viewed_at, captured_at, source_label, device_id,
			archived, starred, deleted_at, group_id,
			content_key, content_type, content_fetched_at, content_version,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			url=excluded.url, title=excluded.title, favicon=excluded.favicon,
			og_title=excluded.og_title, og_description=excluded.og_description,
			og_image=excluded.og_image, meta_description=excluded.meta_description,
			creator=excluded.creator, creator_avatar=excluded.creator_avatar,
			creator_url=excluded.creator_url, published_at=excluded.published_at,
			tags=excluded.tags, notes=excluded.notes, view_count=excluded.view_count,
			last_viewed_at=excluded.last_viewed_at, captured_at=excluded.captured_at,
			source_label=excluded.source_label, device_id=excluded.device_id,
			archived=excluded.archived, starred=excluded.starred, deleted_at=excluded.deleted_at,
			group_id=excluded.group_id, content_key=excluded.content_key,
			content_type=excluded.content_type, content_fetched_at=excluded.content_fetched_at,
			content_version=excluded.content_version, updated_at=excluded.updated_at`,
			p.ID, p.URL, p.Title, p.Favicon, p.OgTitle, p.OgDescription, p.OgImage, p.MetaDescription,
			p.Creator, p.CreatorAvatar, p.CreatorUrl, p.PublishedAt, p.TagsJSON(), p.Notes,
			p.ViewCount, p.LastViewedAt, p.CapturedAt, p.SourceLabel, p.DeviceID,
			boolToInt(p.Archived), boolToInt(p.Starred), p.DeletedAt, p.GroupID,
			p.ContentKey, p.ContentType, p.ContentFetchedAt, p.ContentVersion,
			p.CreatedAt, p.UpdatedAt); err != nil {
			return resp, err
		}
		resp.Pages++
	}

	for i := range req.Templates {
		tmpl := &req.Templates[i]
		now := model.Now()
		if tmpl.CreatedAt == "" {
			tmpl.CreatedAt = now
		}
		tmpl.UpdatedAt = now
		if _, err := tx.Exec(`INSERT INTO templates (id, name, prompt, is_builtin, default_prompt, is_enabled, sort_order, model, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, prompt=excluded.prompt, is_builtin=excluded.is_builtin,
			default_prompt=excluded.default_prompt, is_enabled=excluded.is_enabled,
			sort_order=excluded.sort_order, model=excluded.model, updated_at=excluded.updated_at`,
			tmpl.ID, tmpl.Name, tmpl.Prompt, boolToInt(tmpl.IsBuiltin), tmpl.DefaultPrompt,
			boolToInt(tmpl.IsEnabled), tmpl.SortOrder, tmpl.Model, tmpl.CreatedAt, tmpl.UpdatedAt); err != nil {
			return resp, err
		}
		resp.Templates++
	}

	for i := range req.Documents {
		d := &req.Documents[i]
		now := model.Now()
		if d.CreatedAt == "" {
			d.CreatedAt = now
		}
		d.UpdatedAt = now
		if _, err := tx.Exec(`INSERT INTO documents (id, page_id, template_id, content, generated_at, prompt_used, source_hash, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
			page_id=excluded.page_id, template_id=excluded.template_id, content=excluded.content,
			generated_at=excluded.generated_at, prompt_used=excluded.prompt_used,
			source_hash=excluded.source_hash, updated_at=excluded.updated_at`,
			d.ID, d.PageID, d.TemplateID, d.Content, d.GeneratedAt, d.PromptUsed, d.SourceHash, d.CreatedAt, d.UpdatedAt); err != nil {
			return resp, err
		}
		resp.Documents++
	}

	return resp, tx.Commit()
}
```

- [ ] **Step 2: Create batch handler**

Create `apps/service/internal/handler/batch.go`:

```go
package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) BatchUpsert(w http.ResponseWriter, r *http.Request) {
	var req model.BatchRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	resp, err := db.BatchUpsert(h.DB, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
```

- [ ] **Step 3: Create HTTP server with CORS**

Create `apps/service/internal/server/server.go`:

```go
package server

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"

	"tabzen-service/internal/handler"
)

const DefaultPort = 7824

func Start(db *sql.DB, port int) error {
	h := handler.New(db)
	mux := RegisterRoutes(h)

	wrapped := corsMiddleware(mux)

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}

	log.Printf("TabZen API server listening on http://%s", addr)

	go http.Serve(listener, wrapped)
	return nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Allow chrome-extension:// and moz-extension:// origins, plus localhost for dev.
		allowed := origin == "" ||
			len(origin) > 19 && origin[:19] == "chrome-extension://" ||
			len(origin) > 16 && origin[:16] == "moz-extension://" ||
			len(origin) > 16 && origin[:16] == "http://localhost" ||
			len(origin) > 21 && origin[:21] == "http://127.0.0.1"

		if allowed && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 4: Create route registration**

Create `apps/service/internal/server/routes.go`:

```go
package server

import (
	"net/http"

	"tabzen-service/internal/handler"
)

func RegisterRoutes(h *handler.Handlers) *http.ServeMux {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /api/health", h.Health)

	// Pages
	mux.HandleFunc("GET /api/pages", h.ListPages)
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)
	mux.HandleFunc("POST /api/pages", h.CreatePage)
	mux.HandleFunc("PUT /api/pages/{id}", h.UpdatePage)
	mux.HandleFunc("DELETE /api/pages/{id}", h.DeletePage)

	// Groups
	mux.HandleFunc("GET /api/groups", h.ListGroups)
	mux.HandleFunc("GET /api/groups/{id}", h.GetGroup)
	mux.HandleFunc("POST /api/groups", h.CreateGroup)
	mux.HandleFunc("PUT /api/groups/{id}", h.UpdateGroup)
	mux.HandleFunc("DELETE /api/groups/{id}", h.DeleteGroup)

	// Captures
	mux.HandleFunc("GET /api/captures", h.ListCaptures)
	mux.HandleFunc("POST /api/captures", h.CreateCapture)

	// Templates
	mux.HandleFunc("GET /api/templates", h.ListTemplates)
	mux.HandleFunc("GET /api/templates/{id}", h.GetTemplate)
	mux.HandleFunc("POST /api/templates", h.CreateTemplate)
	mux.HandleFunc("PUT /api/templates/{id}", h.UpdateTemplate)
	mux.HandleFunc("DELETE /api/templates/{id}", h.DeleteTemplate)

	// Documents
	mux.HandleFunc("GET /api/documents", h.ListDocuments)
	mux.HandleFunc("GET /api/documents/{id}", h.GetDocument)
	mux.HandleFunc("POST /api/documents", h.CreateDocument)
	mux.HandleFunc("PUT /api/documents/{id}", h.UpdateDocument)
	mux.HandleFunc("DELETE /api/documents/{id}", h.DeleteDocument)

	// Batch
	mux.HandleFunc("POST /api/batch", h.BatchUpsert)

	return mux
}
```

- [ ] **Step 5: Wire everything in main.go**

Replace `apps/service/main.go` with:

```go
package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"tabzen-service/internal/db"
	"tabzen-service/internal/server"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	database, err := db.Open()
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()

	if err := server.Start(database, server.DefaultPort); err != nil {
		log.Fatalf("Failed to start API server: %v", err)
	}

	app := application.New(application.Options{
		Name:        "TabZen Service",
		Description: "Local data service for Tab Zen",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	systemTray := app.NewSystemTray()
	trayMenu := app.NewMenu()
	trayMenu.Add("TabZen Service v0.1.0").SetEnabled(false)
	trayMenu.AddSeparator()
	trayMenu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	systemTray.SetMenu(trayMenu)
	systemTray.SetLabel("TabZen")

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 6: Run all tests**

```bash
cd apps/service && go test ./... -v
```

Expected: All tests pass. Note: `main.go` is not unit tested -- it's integration-level. The server and handlers are tested independently.

- [ ] **Step 7: Build and verify the binary compiles**

```bash
cd apps/service/frontend && pnpm install && pnpm build
cd apps/service && go build -o bin/tabzen-service .
```

Expected: Binary compiles successfully. Don't run it yet (Wails needs a display environment for the tray icon).

- [ ] **Step 8: Commit**

```bash
git add apps/service/
git commit -m "feat(service): add batch handler, server wiring, CORS, and system tray"
```

---

## Task 7: Extension Adapter Interface and Service Adapter

**Files:**
- Create: `apps/extension/lib/adapters/types.ts`
- Create: `apps/extension/lib/adapters/service-adapter.ts`

**Reference files (read before starting):**
- `apps/extension/lib/db.ts` -- current IndexedDB operations (the interface must match these signatures)
- `apps/extension/lib/types.ts` -- Page, Group, Capture, AITemplate, AIDocument types

- [ ] **Step 1: Define the DataAdapter interface**

Create `apps/extension/lib/adapters/types.ts`:

```typescript
import type { Page, Group, Capture, AITemplate, AIDocument } from "@/lib/types";

export interface DataAdapter {
  // Pages
  addPage(page: Page): Promise<void>;
  addPages(pages: Page[]): Promise<void>;
  getPage(id: string): Promise<Page | undefined>;
  getAllPages(): Promise<Page[]>;
  getPagesByGroup(groupId: string): Promise<Page[]>;
  getPageByUrl(url: string): Promise<Page | undefined>;
  updatePage(id: string, updates: Partial<Page>): Promise<void>;
  softDeletePage(id: string): Promise<void>;
  restorePage(id: string): Promise<void>;
  hardDeletePage(id: string): Promise<void>;
  purgeDeletedPages(olderThanDays: number): Promise<void>;
  searchPages(query: string): Promise<Page[]>;
  getAllTags(): Promise<{ tag: string; count: number }[]>;

  // Groups
  addGroup(group: Group): Promise<void>;
  addGroups(groups: Group[]): Promise<void>;
  getGroup(id: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  getGroupsByCapture(captureId: string): Promise<Group[]>;
  updateGroup(id: string, updates: Partial<Group>): Promise<void>;
  deleteGroup(id: string): Promise<void>;

  // Captures
  addCapture(capture: Capture): Promise<void>;
  getAllCaptures(): Promise<Capture[]>;
  deleteCapture(id: string): Promise<void>;

  // Templates
  getAllTemplates(): Promise<AITemplate[]>;
  getTemplate(id: string): Promise<AITemplate | undefined>;
  putTemplate(template: AITemplate): Promise<void>;
  putTemplates(templates: AITemplate[]): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  // Documents
  getDocumentsForPage(pageId: string): Promise<AIDocument[]>;
  getDocument(pageId: string, templateId: string): Promise<AIDocument | undefined>;
  putDocument(doc: AIDocument): Promise<void>;
  putDocuments(docs: AIDocument[]): Promise<void>;
  deleteDocumentsForPage(pageId: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  getAllDocuments(): Promise<AIDocument[]>;

  // Bulk
  getAllData(): Promise<{
    pages: Page[];
    groups: Group[];
    captures: Capture[];
    aiTemplates: AITemplate[];
    aiDocuments: AIDocument[];
  }>;
  importData(data: {
    pages: Page[];
    groups: Group[];
    captures: Capture[];
  }): Promise<{ imported: number; skipped: number }>;
  clearAllData(): Promise<void>;
}
```

- [ ] **Step 2: Create the service adapter**

Create `apps/extension/lib/adapters/service-adapter.ts`:

```typescript
import type { Page, Group, Capture, AITemplate, AIDocument } from "@/lib/types";
import type { DataAdapter } from "./types";

const BASE_URL = "http://localhost:7824/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request(path, { method: "PUT", body: JSON.stringify(body) });
}

function del<T>(path: string): Promise<T> {
  return request(path, { method: "DELETE" });
}

export const serviceAdapter: DataAdapter = {
  // Pages
  async addPage(page: Page) {
    await post("/pages", page);
  },

  async addPages(pages: Page[]) {
    await post("/pages", pages);
  },

  async getPage(id: string) {
    try {
      return await request<Page>(`/pages/${id}`);
    } catch {
      return undefined;
    }
  },

  async getAllPages() {
    return request<Page[]>("/pages");
  },

  async getPagesByGroup(groupId: string) {
    return request<Page[]>(`/pages?groupId=${encodeURIComponent(groupId)}`);
  },

  async getPageByUrl(url: string) {
    const pages = await request<Page[]>(`/pages?search=${encodeURIComponent(url)}&limit=1`);
    return pages.find((p) => p.url === url);
  },

  async updatePage(id: string, updates: Partial<Page>) {
    await put(`/pages/${id}`, updates);
  },

  async softDeletePage(id: string) {
    await del(`/pages/${id}`);
  },

  async restorePage(id: string) {
    await put(`/pages/${id}`, { deletedAt: null });
  },

  async hardDeletePage(id: string) {
    // The service uses soft delete on DELETE. For hard delete, we'd need a separate endpoint.
    // For phase 1, soft delete is sufficient. The service can purge old soft-deleted pages.
    await del(`/pages/${id}`);
  },

  async purgeDeletedPages(_olderThanDays: number) {
    // Phase 1: no-op. The service will handle purging in a future phase.
  },

  async searchPages(query: string) {
    return request<Page[]>(`/pages?search=${encodeURIComponent(query)}`);
  },

  async getAllTags() {
    // Phase 1: compute client-side from all pages.
    const pages = await request<Page[]>("/pages");
    const tagCounts = new Map<string, number>();
    for (const page of pages) {
      for (const tag of page.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count }));
  },

  // Groups
  async addGroup(group: Group) {
    await post("/groups", group);
  },

  async addGroups(groups: Group[]) {
    // Batch via /api/batch.
    await post("/batch", { pages: [], groups, captures: [], templates: [], documents: [] });
  },

  async getGroup(id: string) {
    try {
      return await request<Group>(`/groups/${id}`);
    } catch {
      return undefined;
    }
  },

  async getAllGroups() {
    return request<Group[]>("/groups");
  },

  async getGroupsByCapture(captureId: string) {
    const groups = await request<Group[]>("/groups");
    return groups.filter((g) => g.captureId === captureId);
  },

  async updateGroup(id: string, updates: Partial<Group>) {
    await put(`/groups/${id}`, updates);
  },

  async deleteGroup(id: string) {
    await del(`/groups/${id}`);
  },

  // Captures
  async addCapture(capture: Capture) {
    await post("/captures", capture);
  },

  async getAllCaptures() {
    return request<Capture[]>("/captures");
  },

  async deleteCapture(_id: string) {
    // Phase 1: captures endpoint only supports create/list. Hard delete not yet implemented.
  },

  // Templates
  async getAllTemplates() {
    return request<AITemplate[]>("/templates");
  },

  async getTemplate(id: string) {
    try {
      return await request<AITemplate>(`/templates/${id}`);
    } catch {
      return undefined;
    }
  },

  async putTemplate(template: AITemplate) {
    await post("/templates", template);
  },

  async putTemplates(templates: AITemplate[]) {
    await post("/batch", { pages: [], groups: [], captures: [], templates, documents: [] });
  },

  async deleteTemplate(id: string) {
    await del(`/templates/${id}`);
  },

  // Documents
  async getDocumentsForPage(pageId: string) {
    return request<AIDocument[]>(`/documents?pageId=${encodeURIComponent(pageId)}`);
  },

  async getDocument(pageId: string, templateId: string) {
    const docs = await request<AIDocument[]>(
      `/documents?pageId=${encodeURIComponent(pageId)}&templateId=${encodeURIComponent(templateId)}&limit=1`,
    );
    return docs[0];
  },

  async putDocument(doc: AIDocument) {
    await post("/documents", doc);
  },

  async putDocuments(docs: AIDocument[]) {
    await post("/batch", { pages: [], groups: [], captures: [], templates: [], documents: docs });
  },

  async deleteDocumentsForPage(pageId: string) {
    const docs = await request<AIDocument[]>(`/documents?pageId=${encodeURIComponent(pageId)}`);
    await Promise.all(docs.map((d) => del(`/documents/${d.id}`)));
  },

  async deleteDocument(id: string) {
    await del(`/documents/${id}`);
  },

  async getAllDocuments() {
    return request<AIDocument[]>("/documents");
  },

  // Bulk
  async getAllData() {
    const [pages, groups, captures, aiTemplates, aiDocuments] = await Promise.all([
      request<Page[]>("/pages"),
      request<Group[]>("/groups"),
      request<Capture[]>("/captures"),
      request<AITemplate[]>("/templates"),
      request<AIDocument[]>("/documents"),
    ]);
    return { pages, groups, captures, aiTemplates, aiDocuments };
  },

  async importData(data) {
    const resp = await post<{ pages: number; groups: number; captures: number }>("/batch", {
      pages: data.pages,
      groups: data.groups,
      captures: data.captures,
      templates: [],
      documents: [],
    });
    return { imported: resp.pages + resp.groups + resp.captures, skipped: 0 };
  },

  async clearAllData() {
    // Phase 1: no endpoint for this. Would need to delete all entities.
    // This is a destructive operation primarily used for testing.
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/adapters/
git commit -m "feat(extension): add DataAdapter interface and LocalServiceAdapter"
```

---

## Task 8: Data Layer, Settings Update, and Migration

**Files:**
- Create: `apps/extension/lib/data-layer.ts`
- Create: `apps/extension/lib/adapters/indexeddb-adapter.ts`
- Modify: `apps/extension/lib/types.ts` -- add `dataSource` to Settings
- Modify: `apps/extension/lib/settings.ts` -- add default for `dataSource`

**Reference files (read before starting):**
- `apps/extension/lib/db.ts` -- every exported function needs to be wrapped
- `apps/extension/lib/types.ts` -- Settings interface
- `apps/extension/lib/settings.ts` -- DEFAULT_SETTINGS, getSettings, updateSettings
- `apps/extension/lib/adapters/types.ts` -- DataAdapter interface (created in Task 7)
- `apps/extension/lib/adapters/service-adapter.ts` -- (created in Task 7)

- [ ] **Step 1: Create IndexedDB adapter wrapper**

Create `apps/extension/lib/adapters/indexeddb-adapter.ts`. This wraps the existing `db.ts` exports into the `DataAdapter` interface:

```typescript
import type { DataAdapter } from "./types";
import * as db from "@/lib/db";

export const indexeddbAdapter: DataAdapter = {
  addPage: db.addPage,
  addPages: db.addPages,
  getPage: db.getPage,
  getAllPages: db.getAllPages,
  getPagesByGroup: db.getPagesByGroup,
  getPageByUrl: db.getPageByUrl,
  updatePage: db.updatePage,
  softDeletePage: db.softDeletePage,
  restorePage: db.restorePage,
  hardDeletePage: db.hardDeletePage,
  purgeDeletedPages: db.purgeDeletedPages,
  searchPages: db.searchPages,
  getAllTags: db.getAllTags,

  addGroup: db.addGroup,
  addGroups: db.addGroups,
  getGroup: db.getGroup,
  getAllGroups: db.getAllGroups,
  getGroupsByCapture: db.getGroupsByCapture,
  updateGroup: db.updateGroup,
  deleteGroup: db.deleteGroup,

  addCapture: db.addCapture,
  getAllCaptures: db.getAllCaptures,
  deleteCapture: db.deleteCapture,

  getAllTemplates: db.getAllTemplates,
  getTemplate: db.getTemplate,
  putTemplate: db.putTemplate,
  putTemplates: db.putTemplates,
  deleteTemplate: db.deleteTemplate,

  getDocumentsForPage: db.getDocumentsForPage,
  getDocument: db.getDocument,
  putDocument: db.putDocument,
  putDocuments: db.putDocuments,
  deleteDocumentsForPage: db.deleteDocumentsForPage,
  deleteDocument: db.deleteDocument,
  getAllDocuments: db.getAllDocuments,

  getAllData: db.getAllData,
  importData: db.importData,
  clearAllData: db.clearAllData,
};
```

- [ ] **Step 2: Create the data layer with auto-detection**

Create `apps/extension/lib/data-layer.ts`:

```typescript
import type { DataAdapter } from "./adapters/types";
import { indexeddbAdapter } from "./adapters/indexeddb-adapter";
import { serviceAdapter } from "./adapters/service-adapter";
import { getSettings } from "./settings";

const SERVICE_HEALTH_URL = "http://localhost:7824/api/health";
const HEALTH_CHECK_INTERVAL = 30_000; // 30 seconds

let activeAdapter: DataAdapter = indexeddbAdapter;
let serviceAvailable = false;
let lastHealthCheck = 0;

async function checkServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(SERVICE_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body.status === "ok";
  } catch {
    return false;
  }
}

export async function initDataLayer(): Promise<DataAdapter> {
  const settings = await getSettings();

  if (settings.dataSource === "local") {
    activeAdapter = indexeddbAdapter;
    return activeAdapter;
  }

  if (settings.dataSource === "service") {
    serviceAvailable = await checkServiceHealth();
    if (!serviceAvailable) {
      throw new Error("TabZen local service is not running");
    }
    activeAdapter = serviceAdapter;
    return activeAdapter;
  }

  // Auto mode: try service, fall back to IndexedDB.
  serviceAvailable = await checkServiceHealth();
  activeAdapter = serviceAvailable ? serviceAdapter : indexeddbAdapter;
  lastHealthCheck = Date.now();

  return activeAdapter;
}

export function getAdapter(): DataAdapter {
  return activeAdapter;
}

export function isServiceActive(): boolean {
  return activeAdapter === serviceAdapter;
}

// Periodically re-check health in auto mode. Call this from background.ts.
export async function refreshAdapterIfNeeded(): Promise<void> {
  const settings = await getSettings();
  if (settings.dataSource !== "auto") return;

  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) return;
  lastHealthCheck = now;

  const available = await checkServiceHealth();
  if (available && !serviceAvailable) {
    // Service came online -- switch to it.
    serviceAvailable = true;
    activeAdapter = serviceAdapter;
  } else if (!available && serviceAvailable) {
    // Service went offline -- fall back.
    serviceAvailable = false;
    activeAdapter = indexeddbAdapter;
  }
}

// Migrate all IndexedDB data to the service.
export async function migrateToService(): Promise<{ imported: number }> {
  const data = await indexeddbAdapter.getAllData();

  const res = await fetch("http://localhost:7824/api/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pages: data.pages,
      groups: data.groups,
      captures: data.captures,
      templates: data.aiTemplates,
      documents: data.aiDocuments,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Migration failed" }));
    throw new Error(err.error);
  }

  const result = await res.json();
  const imported = result.pages + result.groups + result.captures + result.templates + result.documents;
  return { imported };
}
```

- [ ] **Step 3: Add dataSource to Settings type**

Read `apps/extension/lib/types.ts` and add `dataSource` to the `Settings` interface:

Add after the `notchSide` field:

```typescript
  dataSource: "local" | "service" | "auto";
```

- [ ] **Step 4: Add default dataSource to settings**

Read `apps/extension/lib/settings.ts` and add to the `DEFAULT_SETTINGS` object:

```typescript
  dataSource: "local" as const,
```

Note: Default is `"local"` (not `"auto"`) so the service is opt-in. Users must explicitly change this to `"auto"` or `"service"` in settings to try the experimental feature.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/adapters/ apps/extension/lib/data-layer.ts apps/extension/lib/types.ts apps/extension/lib/settings.ts
git commit -m "feat(extension): add data layer with auto-detection, migration, and settings"
```

---

## Task 9: Integration Verification

**Files:** None new -- this task verifies everything works together.

- [ ] **Step 1: Run all Go tests**

```bash
cd apps/service && go test ./... -v
```

Expected: All tests pass.

- [ ] **Step 2: Build the Go binary**

```bash
cd apps/service/frontend && pnpm install && pnpm build
cd apps/service && go build -o bin/tabzen-service .
```

Expected: Binary compiles without errors.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/extension && pnpm exec tsc --noEmit
```

Expected: No TypeScript errors from the new adapter files. If there are pre-existing errors, only verify the new files don't introduce additional errors.

- [ ] **Step 4: Start the service and test with curl**

```bash
cd apps/service && ./bin/tabzen-service &
sleep 2

# Health check
curl -s http://localhost:7824/api/health | jq .

# Create a page
curl -s -X POST http://localhost:7824/api/pages \
  -H "Content-Type: application/json" \
  -d '{"id":"test-1","url":"https://example.com","title":"Test Page","capturedAt":"2026-04-11T00:00:00Z","tags":["test"],"groupId":"g1"}' | jq .

# List pages
curl -s http://localhost:7824/api/pages | jq .

# Create a group
curl -s -X POST http://localhost:7824/api/groups \
  -H "Content-Type: application/json" \
  -d '{"id":"g1","name":"Test Group","captureId":"c1","position":0}' | jq .

# Batch upsert
curl -s -X POST http://localhost:7824/api/batch \
  -H "Content-Type: application/json" \
  -d '{"pages":[],"groups":[],"captures":[{"id":"c1","capturedAt":"2026-04-11T00:00:00Z","sourceLabel":"test","tabCount":1}],"templates":[],"documents":[]}' | jq .

# Kill the service
kill %1
```

Expected: All curl commands return valid JSON responses with correct data.

- [ ] **Step 5: Final commit with any fixes**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix(service): integration fixes from verification testing"
```

If no fixes needed, skip this step.
