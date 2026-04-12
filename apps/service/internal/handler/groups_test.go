package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListGroups(t *testing.T) {
	h := setupTest(t)

	g := model.Group{ID: "g1", Name: "Work", CaptureID: "c1", Position: 0}
	body, _ := json.Marshal(g)

	req := httptest.NewRequest(http.MethodPost, "/api/groups", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateGroup(w, req)
	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/groups", nil)
	w = httptest.NewRecorder()
	h.ListGroups(w, req)
	if w.Code != 200 {
		t.Fatalf("list status = %d, want 200", w.Code)
	}

	var groups []model.Group
	json.NewDecoder(w.Body).Decode(&groups)
	if len(groups) != 1 {
		t.Fatalf("len = %d, want 1", len(groups))
	}
	if groups[0].Name != "Work" {
		t.Errorf("name = %q, want Work", groups[0].Name)
	}
}
