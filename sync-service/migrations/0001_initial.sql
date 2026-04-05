-- Migration number: 0001 	 2026-04-05T21:29:37.263Z
-- Initial schema for Tab Zen sync service

CREATE TABLE IF NOT EXISTS tabs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  favicon TEXT NOT NULL DEFAULT '',
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  meta_description TEXT,
  notes TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  captured_at TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT '',
  device_id TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capture_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT '',
  tab_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  sync_token TEXT PRIMARY KEY,
  ai_model TEXT,
  encrypted_api_key TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tabs_sync ON tabs(sync_token, updated_at);
CREATE INDEX IF NOT EXISTS idx_groups_sync ON groups(sync_token, updated_at);
CREATE INDEX IF NOT EXISTS idx_captures_sync ON captures(sync_token, updated_at);
