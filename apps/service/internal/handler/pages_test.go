package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func setupTest(t *testing.T) *Handlers {
	t.Helper()
	database, err := db.OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close() })
	return New(database)
}

func TestHealthEndpoint(t *testing.T) {
	h := setupTest(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	h.Health(w, req)

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]string
	json.NewDecoder(w.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("status = %q, want ok", body["status"])
	}
	if body["version"] != "0.1.0" {
		t.Errorf("version = %q, want 0.1.0", body["version"])
	}
}

func TestCreateAndListPages(t *testing.T) {
	h := setupTest(t)

	page := model.Page{
		ID:          "p1",
		URL:         "https://example.com",
		Title:       "Example",
		CapturedAt:  model.Now(),
		SourceLabel: "test",
		DeviceID:    "dev1",
		Tags:        []string{"web"},
	}
	body, _ := json.Marshal(page)

	// Create.
	req := httptest.NewRequest(http.MethodPost, "/api/pages", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePage(w, req)
	if w.Code != 201 {
		t.Fatalf("create status = %d, want 201, body: %s", w.Code, w.Body.String())
	}

	// List.
	req = httptest.NewRequest(http.MethodGet, "/api/pages", nil)
	w = httptest.NewRecorder()
	h.ListPages(w, req)
	if w.Code != 200 {
		t.Fatalf("list status = %d, want 200", w.Code)
	}

	var pages []model.Page
	json.NewDecoder(w.Body).Decode(&pages)
	if len(pages) != 1 {
		t.Fatalf("len = %d, want 1", len(pages))
	}
	if pages[0].Title != "Example" {
		t.Errorf("title = %q, want Example", pages[0].Title)
	}
}

func TestGetPage(t *testing.T) {
	h := setupTest(t)

	// Insert directly via db.
	p := &model.Page{ID: "p1", URL: "https://example.com", Title: "Test", CapturedAt: model.Now(), Tags: []string{}}
	db.InsertPage(h.DB, p)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)

	req := httptest.NewRequest(http.MethodGet, "/api/pages/p1", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
	}
	var got model.Page
	json.NewDecoder(w.Body).Decode(&got)
	if got.Title != "Test" {
		t.Errorf("title = %q, want Test", got.Title)
	}
}

func TestGetPageNotFound(t *testing.T) {
	h := setupTest(t)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)

	req := httptest.NewRequest(http.MethodGet, "/api/pages/nonexistent", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 404 {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestDeletePage(t *testing.T) {
	h := setupTest(t)

	p := &model.Page{ID: "p1", URL: "https://example.com", Title: "Test", CapturedAt: model.Now(), Tags: []string{}}
	db.InsertPage(h.DB, p)

	mux := http.NewServeMux()
	mux.HandleFunc("DELETE /api/pages/{id}", h.DeletePage)

	req := httptest.NewRequest(http.MethodDelete, "/api/pages/p1", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != 204 {
		t.Fatalf("status = %d, want 204", w.Code)
	}

	// Verify soft-deleted (not in list).
	req = httptest.NewRequest(http.MethodGet, "/api/pages", nil)
	w = httptest.NewRecorder()
	h.ListPages(w, req)
	var pages []model.Page
	json.NewDecoder(w.Body).Decode(&pages)
	if len(pages) != 0 {
		t.Errorf("len = %d, want 0 after delete", len(pages))
	}
}
