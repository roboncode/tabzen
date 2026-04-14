package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListTemplates(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	t1 := &model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize this", IsBuiltin: true, IsEnabled: true, SortOrder: 1}
	t2 := &model.Template{ID: "t2", Name: "Analysis", Prompt: "Analyze this", IsEnabled: true, SortOrder: 0}

	if err := InsertTemplate(database, t1); err != nil {
		t.Fatal(err)
	}
	if err := InsertTemplate(database, t2); err != nil {
		t.Fatal(err)
	}

	templates, err := ListTemplates(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(templates) != 2 {
		t.Fatalf("len = %d, want 2", len(templates))
	}
	// Should be ordered by sort_order ASC.
	if templates[0].Name != "Analysis" {
		t.Errorf("first template = %q, want Analysis (sort_order 0)", templates[0].Name)
	}
	if !templates[1].IsBuiltin {
		t.Error("expected t1 IsBuiltin=true")
	}

	// Get by ID.
	got, err := GetTemplate(database, "t1")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Name != "Summary" {
		t.Errorf("GetTemplate = %v, want Summary", got)
	}
}

func TestDeleteTemplate(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	tmpl := &model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize", IsEnabled: true}
	if err := InsertTemplate(database, tmpl); err != nil {
		t.Fatal(err)
	}

	if err := DeleteTemplate(database, "t1"); err != nil {
		t.Fatal(err)
	}

	templates, err := ListTemplates(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(templates) != 0 {
		t.Errorf("len = %d, want 0 after delete", len(templates))
	}
}
