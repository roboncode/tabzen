package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListDocuments(w http.ResponseWriter, r *http.Request) {
	f := db.DocumentFilter{
		PageID:     queryString(r, "pageId"),
		TemplateID: queryString(r, "templateId"),
		Limit:      queryInt(r, "limit", 0),
		Offset:     queryInt(r, "offset", 0),
	}
	docs, err := db.ListDocuments(h.DB, f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, docs)
}

func (h *Handlers) GetDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	doc, err := db.GetDocument(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if doc == nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *Handlers) CreateDocument(w http.ResponseWriter, r *http.Request) {
	var d model.Document
	if err := readJSON(r, &d); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := db.InsertDocument(h.DB, &d); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}

func (h *Handlers) UpdateDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	keyMap := map[string]string{
		"pageId":      "page_id",
		"templateId":  "template_id",
		"content":     "content",
		"generatedAt": "generated_at",
		"promptUsed":  "prompt_used",
		"sourceHash":  "source_hash",
	}

	updates := map[string]any{}
	for jsonKey, val := range body {
		dbCol, ok := keyMap[jsonKey]
		if !ok {
			continue
		}
		updates[dbCol] = val
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no valid fields to update")
		return
	}

	doc, err := db.UpdateDocument(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if doc == nil {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *Handlers) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteDocument(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
