package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

type DocumentFilter struct {
	PageID     *string
	TemplateID *string
	Limit      int
	Offset     int
}

var documentColumns = `id, page_id, template_id, content, generated_at, prompt_used, source_hash, created_at, updated_at`

func scanDocument(row interface{ Scan(dest ...any) error }) (*model.Document, error) {
	var d model.Document
	err := row.Scan(&d.ID, &d.PageID, &d.TemplateID, &d.Content,
		&d.GeneratedAt, &d.PromptUsed, &d.SourceHash, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func ListDocuments(db *sql.DB, f DocumentFilter) ([]model.Document, error) {
	query := "SELECT " + documentColumns + " FROM documents WHERE 1=1"
	args := []any{}

	if f.PageID != nil {
		query += " AND page_id = ?"
		args = append(args, *f.PageID)
	}
	if f.TemplateID != nil {
		query += " AND template_id = ?"
		args = append(args, *f.TemplateID)
	}

	query += " ORDER BY created_at DESC"

	if f.Limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", f.Limit)
	}
	if f.Offset > 0 {
		query += fmt.Sprintf(" OFFSET %d", f.Offset)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list documents: %w", err)
	}
	defer rows.Close()

	var docs []model.Document
	for rows.Next() {
		d, err := scanDocument(rows)
		if err != nil {
			return nil, fmt.Errorf("scan document: %w", err)
		}
		docs = append(docs, *d)
	}
	if docs == nil {
		docs = []model.Document{}
	}
	return docs, rows.Err()
}

func GetDocument(db *sql.DB, id string) (*model.Document, error) {
	row := db.QueryRow("SELECT "+documentColumns+" FROM documents WHERE id = ?", id)
	d, err := scanDocument(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get document: %w", err)
	}
	return d, nil
}

func InsertDocument(db *sql.DB, d *model.Document) error {
	now := model.Now()
	if d.CreatedAt == "" {
		d.CreatedAt = now
	}
	d.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO documents (`+documentColumns+`)
		VALUES (?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			page_id=excluded.page_id, template_id=excluded.template_id,
			content=excluded.content, generated_at=excluded.generated_at,
			prompt_used=excluded.prompt_used, source_hash=excluded.source_hash,
			updated_at=excluded.updated_at`,
		d.ID, d.PageID, d.TemplateID, d.Content,
		d.GeneratedAt, d.PromptUsed, d.SourceHash, d.CreatedAt, d.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert document: %w", err)
	}
	return nil
}

func UpdateDocument(db *sql.DB, id string, updates map[string]any) (*model.Document, error) {
	updates["updated_at"] = model.Now()
	setCols, args := buildUpdateSets(updates)
	args = append(args, id)

	_, err := db.Exec("UPDATE documents SET "+setCols+" WHERE id = ?", args...)
	if err != nil {
		return nil, fmt.Errorf("update document: %w", err)
	}
	return GetDocument(db, id)
}

func DeleteDocument(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM documents WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	return nil
}
