package db

import (
	"database/sql"
	"fmt"
)

// Migrate runs all pending migrations against the database.
func Migrate(db *sql.DB) error {
	// Ensure schema_version table exists.
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema_version: %w", err)
	}

	var current int
	row := db.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_version`)
	if err := row.Scan(&current); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}

	if current < 1 {
		if err := migrateV1(db); err != nil {
			return fmt.Errorf("migrate v1: %w", err)
		}
	}

	return nil
}

func migrateV1(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
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

	for _, s := range stmts {
		if _, err := tx.Exec(s); err != nil {
			return fmt.Errorf("exec %q: %w", s[:40], err)
		}
	}

	return tx.Commit()
}
