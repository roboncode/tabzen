package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

var templateColumns = `id, name, prompt, is_builtin, default_prompt, is_enabled, sort_order, model, created_at, updated_at`

func scanTemplate(row interface{ Scan(dest ...any) error }) (*model.Template, error) {
	var t model.Template
	var isBuiltin, isEnabled int
	err := row.Scan(&t.ID, &t.Name, &t.Prompt, &isBuiltin, &t.DefaultPrompt,
		&isEnabled, &t.SortOrder, &t.Model, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	t.IsBuiltin = isBuiltin != 0
	t.IsEnabled = isEnabled != 0
	return &t, nil
}

func ListTemplates(db *sql.DB) ([]model.Template, error) {
	rows, err := db.Query("SELECT " + templateColumns + " FROM templates ORDER BY sort_order ASC")
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	defer rows.Close()

	var templates []model.Template
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, fmt.Errorf("scan template: %w", err)
		}
		templates = append(templates, *t)
	}
	if templates == nil {
		templates = []model.Template{}
	}
	return templates, rows.Err()
}

func GetTemplate(db *sql.DB, id string) (*model.Template, error) {
	row := db.QueryRow("SELECT "+templateColumns+" FROM templates WHERE id = ?", id)
	t, err := scanTemplate(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get template: %w", err)
	}
	return t, nil
}

func InsertTemplate(db *sql.DB, tmpl *model.Template) error {
	now := model.Now()
	if tmpl.CreatedAt == "" {
		tmpl.CreatedAt = now
	}
	tmpl.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO templates (`+templateColumns+`)
		VALUES (?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, prompt=excluded.prompt,
			is_builtin=excluded.is_builtin, default_prompt=excluded.default_prompt,
			is_enabled=excluded.is_enabled, sort_order=excluded.sort_order,
			model=excluded.model, updated_at=excluded.updated_at`,
		tmpl.ID, tmpl.Name, tmpl.Prompt, BoolToInt(tmpl.IsBuiltin),
		tmpl.DefaultPrompt, BoolToInt(tmpl.IsEnabled), tmpl.SortOrder,
		tmpl.Model, tmpl.CreatedAt, tmpl.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert template: %w", err)
	}
	return nil
}

func UpdateTemplate(db *sql.DB, id string, updates map[string]any) (*model.Template, error) {
	updates["updated_at"] = model.Now()
	setCols, args := buildUpdateSets(updates)
	args = append(args, id)

	_, err := db.Exec("UPDATE templates SET "+setCols+" WHERE id = ?", args...)
	if err != nil {
		return nil, fmt.Errorf("update template: %w", err)
	}
	return GetTemplate(db, id)
}

func DeleteTemplate(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM templates WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete template: %w", err)
	}
	return nil
}
