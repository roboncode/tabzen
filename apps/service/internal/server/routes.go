package server

import (
	"net/http"

	"tabzen-service/internal/handler"
)

func RegisterRoutes(h *handler.Handlers) *http.ServeMux {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /api/health", h.Health)

	// Pages
	mux.HandleFunc("GET /api/pages", h.ListPages)
	mux.HandleFunc("GET /api/pages/{id}", h.GetPage)
	mux.HandleFunc("POST /api/pages", h.CreatePage)
	mux.HandleFunc("PUT /api/pages/{id}", h.UpdatePage)
	mux.HandleFunc("DELETE /api/pages/{id}", h.DeletePage)

	// Groups
	mux.HandleFunc("GET /api/groups", h.ListGroups)
	mux.HandleFunc("GET /api/groups/{id}", h.GetGroup)
	mux.HandleFunc("POST /api/groups", h.CreateGroup)
	mux.HandleFunc("PUT /api/groups/{id}", h.UpdateGroup)
	mux.HandleFunc("DELETE /api/groups/{id}", h.DeleteGroup)

	// Captures
	mux.HandleFunc("GET /api/captures", h.ListCaptures)
	mux.HandleFunc("POST /api/captures", h.CreateCapture)

	// Templates
	mux.HandleFunc("GET /api/templates", h.ListTemplates)
	mux.HandleFunc("GET /api/templates/{id}", h.GetTemplate)
	mux.HandleFunc("POST /api/templates", h.CreateTemplate)
	mux.HandleFunc("PUT /api/templates/{id}", h.UpdateTemplate)
	mux.HandleFunc("DELETE /api/templates/{id}", h.DeleteTemplate)

	// Documents
	mux.HandleFunc("GET /api/documents", h.ListDocuments)
	mux.HandleFunc("GET /api/documents/{id}", h.GetDocument)
	mux.HandleFunc("POST /api/documents", h.CreateDocument)
	mux.HandleFunc("PUT /api/documents/{id}", h.UpdateDocument)
	mux.HandleFunc("DELETE /api/documents/{id}", h.DeleteDocument)

	// Batch
	mux.HandleFunc("POST /api/batch", h.BatchUpsert)

	return mux
}
