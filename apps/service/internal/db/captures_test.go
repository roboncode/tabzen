package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListCaptures(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	c1 := &model.Capture{ID: "c1", CapturedAt: "2025-01-02T00:00:00Z", SourceLabel: "chrome", TabCount: 5}
	c2 := &model.Capture{ID: "c2", CapturedAt: "2025-01-01T00:00:00Z", SourceLabel: "firefox", TabCount: 3}

	if err := InsertCapture(database, c1); err != nil {
		t.Fatal(err)
	}
	if err := InsertCapture(database, c2); err != nil {
		t.Fatal(err)
	}

	captures, err := ListCaptures(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(captures) != 2 {
		t.Fatalf("len = %d, want 2", len(captures))
	}
	// Should be ordered by captured_at DESC.
	if captures[0].ID != "c1" {
		t.Errorf("first capture = %q, want c1", captures[0].ID)
	}

	// Upsert: update tab_count.
	c1.TabCount = 10
	if err := InsertCapture(database, c1); err != nil {
		t.Fatal(err)
	}
	captures, err = ListCaptures(database)
	if err != nil {
		t.Fatal(err)
	}
	if captures[0].TabCount != 10 {
		t.Errorf("tab_count = %d, want 10 after upsert", captures[0].TabCount)
	}
}
