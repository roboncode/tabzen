package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := db.ListTemplates(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

func (h *Handlers) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tmpl, err := db.GetTemplate(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tmpl == nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

func (h *Handlers) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var t model.Template
	if err := readJSON(r, &t); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := db.InsertTemplate(h.DB, &t); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *Handlers) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	keyMap := map[string]string{
		"name":          "name",
		"prompt":        "prompt",
		"isBuiltin":     "is_builtin",
		"defaultPrompt": "default_prompt",
		"isEnabled":     "is_enabled",
		"sortOrder":     "sort_order",
		"model":         "model",
	}

	updates := map[string]any{}
	for jsonKey, val := range body {
		dbCol, ok := keyMap[jsonKey]
		if !ok {
			continue
		}
		switch dbCol {
		case "is_builtin", "is_enabled":
			if b, ok := val.(bool); ok {
				updates[dbCol] = db.BoolToInt(b)
			}
		default:
			updates[dbCol] = val
		}
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no valid fields to update")
		return
	}

	tmpl, err := db.UpdateTemplate(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tmpl == nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

func (h *Handlers) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteTemplate(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
