package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func testPage(id string) *model.Page {
	return &model.Page{
		ID:          id,
		URL:         "https://example.com/" + id,
		Title:       "Page " + id,
		Favicon:     "https://example.com/favicon.ico",
		CapturedAt:  model.Now(),
		SourceLabel: "test",
		DeviceID:    "dev1",
		GroupID:     "g1",
		Tags:        []string{"go", "test"},
	}
}

func TestInsertAndGetPage(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	p := testPage("p1")
	if err := InsertPage(database, p); err != nil {
		t.Fatalf("InsertPage: %v", err)
	}

	got, err := GetPage(database, "p1")
	if err != nil {
		t.Fatalf("GetPage: %v", err)
	}
	if got == nil {
		t.Fatal("expected page, got nil")
	}
	if got.Title != "Page p1" {
		t.Errorf("title = %q, want %q", got.Title, "Page p1")
	}
	if len(got.Tags) != 2 || got.Tags[0] != "go" {
		t.Errorf("tags = %v, want [go test]", got.Tags)
	}
	if got.Archived {
		t.Error("expected archived=false")
	}
}

func TestListPages(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	for _, id := range []string{"p1", "p2", "p3"} {
		p := testPage(id)
		if id == "p2" {
			p.Starred = true
		}
		if err := InsertPage(database, p); err != nil {
			t.Fatal(err)
		}
	}

	// List all.
	pages, err := ListPages(database, PageFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 3 {
		t.Errorf("len = %d, want 3", len(pages))
	}

	// Filter by starred.
	starred := true
	pages, err = ListPages(database, PageFilter{Starred: &starred})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 1 {
		t.Errorf("starred len = %d, want 1", len(pages))
	}

	// Limit.
	pages, err = ListPages(database, PageFilter{Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 2 {
		t.Errorf("limit len = %d, want 2", len(pages))
	}
}

func TestSoftDeletePage(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	p := testPage("p1")
	if err := InsertPage(database, p); err != nil {
		t.Fatal(err)
	}

	if err := SoftDeletePage(database, "p1"); err != nil {
		t.Fatal(err)
	}

	// Should not appear in list.
	pages, err := ListPages(database, PageFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 0 {
		t.Errorf("len = %d, want 0 after soft delete", len(pages))
	}

	// But should still be gettable.
	got, err := GetPage(database, "p1")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("expected soft-deleted page to still be gettable")
	}
	if got.DeletedAt == nil {
		t.Error("expected deleted_at to be set")
	}
}

func TestSearchPages(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	p1 := testPage("p1")
	p1.Title = "Learn Go Programming"
	p1.Tags = []string{"golang", "tutorial"}

	p2 := testPage("p2")
	p2.Title = "Rust Basics"
	p2.Tags = []string{"rust"}

	if err := InsertPage(database, p1); err != nil {
		t.Fatal(err)
	}
	if err := InsertPage(database, p2); err != nil {
		t.Fatal(err)
	}

	// Text search.
	s := "Go"
	pages, err := ListPages(database, PageFilter{Search: &s})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 1 {
		t.Errorf("text search len = %d, want 1", len(pages))
	}

	// Tag search.
	tag := "#golang"
	pages, err = ListPages(database, PageFilter{Search: &tag})
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 1 {
		t.Errorf("tag search len = %d, want 1", len(pages))
	}
}

func TestUpdatePage(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	p := testPage("p1")
	if err := InsertPage(database, p); err != nil {
		t.Fatal(err)
	}

	updated, err := UpdatePage(database, "p1", map[string]any{
		"title":   "Updated Title",
		"starred": BoolToInt(true),
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Title != "Updated Title" {
		t.Errorf("title = %q, want %q", updated.Title, "Updated Title")
	}
	if !updated.Starred {
		t.Error("expected starred=true after update")
	}
}
