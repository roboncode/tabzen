package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

var captureColumns = `id, captured_at, source_label, tab_count, created_at`

func scanCapture(row interface{ Scan(dest ...any) error }) (*model.Capture, error) {
	var c model.Capture
	err := row.Scan(&c.ID, &c.CapturedAt, &c.SourceLabel, &c.TabCount, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func ListCaptures(db *sql.DB) ([]model.Capture, error) {
	rows, err := db.Query("SELECT " + captureColumns + " FROM captures ORDER BY captured_at DESC")
	if err != nil {
		return nil, fmt.Errorf("list captures: %w", err)
	}
	defer rows.Close()

	var captures []model.Capture
	for rows.Next() {
		c, err := scanCapture(rows)
		if err != nil {
			return nil, fmt.Errorf("scan capture: %w", err)
		}
		captures = append(captures, *c)
	}
	if captures == nil {
		captures = []model.Capture{}
	}
	return captures, rows.Err()
}

func InsertCapture(db *sql.DB, c *model.Capture) error {
	now := model.Now()
	if c.CreatedAt == "" {
		c.CreatedAt = now
	}

	_, err := db.Exec(`INSERT INTO captures (`+captureColumns+`)
		VALUES (?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			captured_at=excluded.captured_at, source_label=excluded.source_label,
			tab_count=excluded.tab_count`,
		c.ID, c.CapturedAt, c.SourceLabel, c.TabCount, c.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert capture: %w", err)
	}
	return nil
}
