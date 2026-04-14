package handler

import (
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

func (h *Handlers) ListCaptures(w http.ResponseWriter, r *http.Request) {
	captures, err := db.ListCaptures(h.DB)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, captures)
}

func (h *Handlers) DeleteCapture(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.DeleteCapture(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) CreateCapture(w http.ResponseWriter, r *http.Request) {
	var c model.Capture
	if err := readJSON(r, &c); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := db.InsertCapture(h.DB, &c); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, c)
}
