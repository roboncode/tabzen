ALTER TABLE tabs ADD COLUMN creator TEXT;
ALTER TABLE tabs ADD COLUMN creator_avatar TEXT;
ALTER TABLE tabs ADD COLUMN creator_url TEXT;
ALTER TABLE tabs ADD COLUMN published_at TEXT;
ALTER TABLE tabs ADD COLUMN tags TEXT;
ALTER TABLE tabs ADD COLUMN deleted_at TEXT;
-- Note: `starred` is already defined in 0001_initial.sql; re-adding it here
-- fails with "duplicate column name: starred". Intentionally omitted.
