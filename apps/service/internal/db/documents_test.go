package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListDocuments(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	d1 := &model.Document{ID: "d1", PageID: "p1", TemplateID: "t1", Content: "Summary of page", GeneratedAt: model.Now(), PromptUsed: "summarize"}
	d2 := &model.Document{ID: "d2", PageID: "p1", TemplateID: "t2", Content: "Analysis of page", GeneratedAt: model.Now(), PromptUsed: "analyze"}
	d3 := &model.Document{ID: "d3", PageID: "p2", TemplateID: "t1", Content: "Summary of page 2", GeneratedAt: model.Now(), PromptUsed: "summarize"}

	for _, d := range []*model.Document{d1, d2, d3} {
		if err := InsertDocument(database, d); err != nil {
			t.Fatal(err)
		}
	}

	// List all.
	docs, err := ListDocuments(database, DocumentFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(docs) != 3 {
		t.Fatalf("len = %d, want 3", len(docs))
	}

	// Filter by pageId.
	pageID := "p1"
	docs, err = ListDocuments(database, DocumentFilter{PageID: &pageID})
	if err != nil {
		t.Fatal(err)
	}
	if len(docs) != 2 {
		t.Errorf("pageId filter len = %d, want 2", len(docs))
	}

	// Filter by templateId.
	templateID := "t1"
	docs, err = ListDocuments(database, DocumentFilter{TemplateID: &templateID})
	if err != nil {
		t.Fatal(err)
	}
	if len(docs) != 2 {
		t.Errorf("templateId filter len = %d, want 2", len(docs))
	}

	// Filter by both.
	docs, err = ListDocuments(database, DocumentFilter{PageID: &pageID, TemplateID: &templateID})
	if err != nil {
		t.Fatal(err)
	}
	if len(docs) != 1 {
		t.Errorf("combined filter len = %d, want 1", len(docs))
	}
}
