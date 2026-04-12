package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListDocuments(t *testing.T) {
	h := setupTest(t)

	d := model.Document{ID: "d1", PageID: "p1", TemplateID: "t1", Content: "Summary", GeneratedAt: model.Now(), PromptUsed: "summarize"}
	body, _ := json.Marshal(d)

	req := httptest.NewRequest(http.MethodPost, "/api/documents", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateDocument(w, req)
	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	// List with pageId filter.
	req = httptest.NewRequest(http.MethodGet, "/api/documents?pageId=p1", nil)
	w = httptest.NewRecorder()
	h.ListDocuments(w, req)
	if w.Code != 200 {
		t.Fatalf("list status = %d, want 200", w.Code)
	}

	var docs []model.Document
	json.NewDecoder(w.Body).Decode(&docs)
	if len(docs) != 1 {
		t.Fatalf("len = %d, want 1", len(docs))
	}
	if docs[0].Content != "Summary" {
		t.Errorf("content = %q, want Summary", docs[0].Content)
	}

	// List with non-matching filter.
	req = httptest.NewRequest(http.MethodGet, "/api/documents?pageId=p999", nil)
	w = httptest.NewRecorder()
	h.ListDocuments(w, req)
	var empty []model.Document
	json.NewDecoder(w.Body).Decode(&empty)
	if len(empty) != 0 {
		t.Errorf("len = %d, want 0 for non-matching filter", len(empty))
	}
}
