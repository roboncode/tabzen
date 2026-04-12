package db

import (
	"database/sql"
	"fmt"
	"strings"

	"tabzen-service/internal/model"
)

type PageFilter struct {
	Archived *bool
	Starred  *bool
	GroupID  *string
	Search   *string
	Limit    int
	Offset   int
}

func BoolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func buildUpdateSets(updates map[string]any) (string, []any) {
	cols := make([]string, 0, len(updates))
	vals := make([]any, 0, len(updates))
	for col, val := range updates {
		cols = append(cols, col+" = ?")
		vals = append(vals, val)
	}
	return strings.Join(cols, ", "), vals
}

var pageColumns = `id, url, title, favicon, og_title, og_description, og_image,
	meta_description, creator, creator_avatar, creator_url, published_at,
	tags, notes, view_count, last_viewed_at, captured_at, source_label,
	device_id, archived, starred, deleted_at, group_id, content_key,
	content_type, content_fetched_at, content_version, created_at, updated_at`

func scanPage(row interface{ Scan(dest ...any) error }) (*model.Page, error) {
	var p model.Page
	var tagsJSON string
	var archived, starred int
	err := row.Scan(
		&p.ID, &p.URL, &p.Title, &p.Favicon,
		&p.OgTitle, &p.OgDescription, &p.OgImage,
		&p.MetaDescription, &p.Creator, &p.CreatorAvatar, &p.CreatorUrl,
		&p.PublishedAt, &tagsJSON, &p.Notes,
		&p.ViewCount, &p.LastViewedAt, &p.CapturedAt, &p.SourceLabel,
		&p.DeviceID, &archived, &starred, &p.DeletedAt, &p.GroupID,
		&p.ContentKey, &p.ContentType, &p.ContentFetchedAt, &p.ContentVersion,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.Archived = archived != 0
	p.Starred = starred != 0
	p.ParseTags(tagsJSON)
	return &p, nil
}

func ListPages(db *sql.DB, f PageFilter) ([]model.Page, error) {
	query := "SELECT " + pageColumns + " FROM pages WHERE deleted_at IS NULL"
	args := []any{}

	if f.Archived != nil {
		query += " AND archived = ?"
		args = append(args, BoolToInt(*f.Archived))
	}
	if f.Starred != nil {
		query += " AND starred = ?"
		args = append(args, BoolToInt(*f.Starred))
	}
	if f.GroupID != nil {
		query += " AND group_id = ?"
		args = append(args, *f.GroupID)
	}
	if f.Search != nil && *f.Search != "" {
		s := *f.Search
		if strings.HasPrefix(s, "#") {
			tag := s[1:]
			query += " AND tags LIKE ?"
			args = append(args, "%\""+tag+"\"%")
		} else {
			query += " AND (title LIKE ? OR url LIKE ?)"
			like := "%" + s + "%"
			args = append(args, like, like)
		}
	}

	query += " ORDER BY captured_at DESC"

	if f.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", f.Limit)
	}
	if f.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", f.Offset)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list pages: %w", err)
	}
	defer rows.Close()

	var pages []model.Page
	for rows.Next() {
		p, err := scanPage(rows)
		if err != nil {
			return nil, fmt.Errorf("scan page: %w", err)
		}
		pages = append(pages, *p)
	}
	if pages == nil {
		pages = []model.Page{}
	}
	return pages, rows.Err()
}

func GetPage(db *sql.DB, id string) (*model.Page, error) {
	row := db.QueryRow("SELECT "+pageColumns+" FROM pages WHERE id = ?", id)
	p, err := scanPage(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get page: %w", err)
	}
	return p, nil
}

func InsertPage(db *sql.DB, p *model.Page) error {
	now := model.Now()
	if p.CreatedAt == "" {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	if p.Tags == nil {
		p.Tags = []string{}
	}

	_, err := db.Exec(`INSERT INTO pages (`+pageColumns+`)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			url=excluded.url, title=excluded.title, favicon=excluded.favicon,
			og_title=excluded.og_title, og_description=excluded.og_description,
			og_image=excluded.og_image, meta_description=excluded.meta_description,
			creator=excluded.creator, creator_avatar=excluded.creator_avatar,
			creator_url=excluded.creator_url, published_at=excluded.published_at,
			tags=excluded.tags, notes=excluded.notes, view_count=excluded.view_count,
			last_viewed_at=excluded.last_viewed_at, captured_at=excluded.captured_at,
			source_label=excluded.source_label, device_id=excluded.device_id,
			archived=excluded.archived, starred=excluded.starred,
			deleted_at=excluded.deleted_at, group_id=excluded.group_id,
			content_key=excluded.content_key, content_type=excluded.content_type,
			content_fetched_at=excluded.content_fetched_at,
			content_version=excluded.content_version,
			updated_at=excluded.updated_at`,
		p.ID, p.URL, p.Title, p.Favicon,
		p.OgTitle, p.OgDescription, p.OgImage,
		p.MetaDescription, p.Creator, p.CreatorAvatar, p.CreatorUrl,
		p.PublishedAt, p.TagsJSON(), p.Notes,
		p.ViewCount, p.LastViewedAt, p.CapturedAt, p.SourceLabel,
		p.DeviceID, BoolToInt(p.Archived), BoolToInt(p.Starred),
		p.DeletedAt, p.GroupID, p.ContentKey, p.ContentType,
		p.ContentFetchedAt, p.ContentVersion,
		p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert page: %w", err)
	}
	return nil
}

func UpdatePage(db *sql.DB, id string, updates map[string]any) (*model.Page, error) {
	updates["updated_at"] = model.Now()
	setCols, args := buildUpdateSets(updates)
	args = append(args, id)

	_, err := db.Exec("UPDATE pages SET "+setCols+" WHERE id = ?", args...)
	if err != nil {
		return nil, fmt.Errorf("update page: %w", err)
	}
	return GetPage(db, id)
}

func SoftDeletePage(db *sql.DB, id string) error {
	_, err := db.Exec("UPDATE pages SET deleted_at = ?, updated_at = ? WHERE id = ?",
		model.Now(), model.Now(), id)
	if err != nil {
		return fmt.Errorf("soft delete page: %w", err)
	}
	return nil
}
