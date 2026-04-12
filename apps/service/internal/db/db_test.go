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
	for _, tbl := range tables {
		var name string
		err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tbl).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", tbl, err)
		}
	}

	// Verify schema version is 1.
	var version int
	if err := db.QueryRow(`SELECT MAX(version) FROM schema_version`).Scan(&version); err != nil {
		t.Fatalf("read schema version: %v", err)
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

	// Run migrate again -- should not error.
	if err := Migrate(db); err != nil {
		t.Fatalf("second Migrate failed: %v", err)
	}

	// Version should still be 1.
	var version int
	if err := db.QueryRow(`SELECT MAX(version) FROM schema_version`).Scan(&version); err != nil {
		t.Fatalf("read schema version: %v", err)
	}
	if version != 1 {
		t.Errorf("expected schema version 1 after double migrate, got %d", version)
	}
}
