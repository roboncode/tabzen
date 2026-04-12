package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := db.ListGroups(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, groups)
}

func (h *Handlers) GetGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	group, err := db.GetGroup(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if group == nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (h *Handlers) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var g model.Group
	if err := readJSON(r, &g); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := db.InsertGroup(h.DB, &g); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

func (h *Handlers) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	keyMap := map[string]string{
		"name":      "name",
		"captureId": "capture_id",
		"position":  "position",
		"archived":  "archived",
	}

	updates := map[string]any{}
	for jsonKey, val := range body {
		dbCol, ok := keyMap[jsonKey]
		if !ok {
			continue
		}
		if dbCol == "archived" {
			if b, ok := val.(bool); ok {
				updates[dbCol] = db.BoolToInt(b)
			}
		} else {
			updates[dbCol] = val
		}
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no valid fields to update")
		return
	}

	group, err := db.UpdateGroup(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if group == nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (h *Handlers) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteGroup(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
