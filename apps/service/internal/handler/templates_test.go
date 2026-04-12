package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListTemplates(t *testing.T) {
	h := setupTest(t)

	tmpl := model.Template{ID: "t1", Name: "Summary", Prompt: "Summarize this", IsEnabled: true, SortOrder: 0}
	body, _ := json.Marshal(tmpl)

	req := httptest.NewRequest(http.MethodPost, "/api/templates", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateTemplate(w, req)
	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/templates", nil)
	w = httptest.NewRecorder()
	h.ListTemplates(w, req)
	if w.Code != 200 {
		t.Fatalf("list status = %d, want 200", w.Code)
	}

	var templates []model.Template
	json.NewDecoder(w.Body).Decode(&templates)
	if len(templates) != 1 {
		t.Fatalf("len = %d, want 1", len(templates))
	}
	if templates[0].Name != "Summary" {
		t.Errorf("name = %q, want Summary", templates[0].Name)
	}
}
