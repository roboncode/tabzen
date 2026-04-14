package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/model"
)

func TestCreateAndListCaptures(t *testing.T) {
	h := setupTest(t)

	c := model.Capture{ID: "c1", CapturedAt: model.Now(), SourceLabel: "chrome", TabCount: 5}
	body, _ := json.Marshal(c)

	req := httptest.NewRequest(http.MethodPost, "/api/captures", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateCapture(w, req)
	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/api/captures", nil)
	w = httptest.NewRecorder()
	h.ListCaptures(w, req)
	if w.Code != 200 {
		t.Fatalf("list status = %d, want 200", w.Code)
	}

	var captures []model.Capture
	json.NewDecoder(w.Body).Decode(&captures)
	if len(captures) != 1 {
		t.Fatalf("len = %d, want 1", len(captures))
	}
	if captures[0].TabCount != 5 {
		t.Errorf("tabCount = %d, want 5", captures[0].TabCount)
	}
}
