package handler

import (
	"encoding/json"
	"net/http"

	"tabzen-service/internal/db"
	"tabzen-service/internal/model"
)

var pageKeyMap = map[string]string{
	"url":              "url",
	"title":            "title",
	"favicon":          "favicon",
	"ogTitle":          "og_title",
	"ogDescription":    "og_description",
	"ogImage":          "og_image",
	"metaDescription":  "meta_description",
	"creator":          "creator",
	"creatorAvatar":    "creator_avatar",
	"creatorUrl":       "creator_url",
	"publishedAt":      "published_at",
	"tags":             "tags",
	"notes":            "notes",
	"viewCount":        "view_count",
	"lastViewedAt":     "last_viewed_at",
	"capturedAt":       "captured_at",
	"sourceLabel":      "source_label",
	"deviceId":         "device_id",
	"archived":         "archived",
	"starred":          "starred",
	"groupId":          "group_id",
	"contentKey":       "content_key",
	"contentType":      "content_type",
	"contentFetchedAt": "content_fetched_at",
	"contentVersion":   "content_version",
}

func (h *Handlers) ListPages(w http.ResponseWriter, r *http.Request) {
	f := db.PageFilter{
		Archived: queryBool(r, "archived"),
		Starred:  queryBool(r, "starred"),
		GroupID:  queryString(r, "groupId"),
		Search:   queryString(r, "search"),
		Limit:    queryInt(r, "limit", 0),
		Offset:   queryInt(r, "offset", 0),
	}
	pages, err := db.ListPages(h.DB, f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pages)
}

func (h *Handlers) GetPage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	page, err := db.GetPage(h.DB, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if page == nil {
		writeError(w, http.StatusNotFound, "page not found")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handlers) CreatePage(w http.ResponseWriter, r *http.Request) {
	// Try to decode as array first, fall back to single object.
	var raw json.RawMessage
	if err := readJSON(r, &raw); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var pages []model.Page
	if err := json.Unmarshal(raw, &pages); err != nil {
		// Try single object.
		var page model.Page
		if err2 := json.Unmarshal(raw, &page); err2 != nil {
			writeError(w, http.StatusBadRequest, err2.Error())
			return
		}
		pages = []model.Page{page}
	}

	for i := range pages {
		if err := db.InsertPage(h.DB, &pages[i]); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	if len(pages) == 1 {
		writeJSON(w, http.StatusCreated, pages[0])
	} else {
		writeJSON(w, http.StatusCreated, pages)
	}
}

func (h *Handlers) UpdatePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	updates := map[string]any{}
	for jsonKey, val := range body {
		dbCol, ok := pageKeyMap[jsonKey]
		if !ok {
			continue
		}
		switch dbCol {
		case "archived", "starred":
			if b, ok := val.(bool); ok {
				updates[dbCol] = db.BoolToInt(b)
			}
		case "tags":
			b, _ := json.Marshal(val)
			updates[dbCol] = string(b)
		default:
			updates[dbCol] = val
		}
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no valid fields to update")
		return
	}

	page, err := db.UpdatePage(h.DB, id, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if page == nil {
		writeError(w, http.StatusNotFound, "page not found")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handlers) DeletePage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := db.SoftDeletePage(h.DB, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
