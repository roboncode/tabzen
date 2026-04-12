package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

var groupColumns = `id, name, capture_id, position, archived, created_at, updated_at`

func scanGroup(row interface{ Scan(dest ...any) error }) (*model.Group, error) {
	var g model.Group
	var archived int
	err := row.Scan(&g.ID, &g.Name, &g.CaptureID, &g.Position, &archived, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return nil, err
	}
	g.Archived = archived != 0
	return &g, nil
}

func ListGroups(db *sql.DB) ([]model.Group, error) {
	rows, err := db.Query("SELECT " + groupColumns + " FROM groups ORDER BY position ASC")
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	defer rows.Close()

	var groups []model.Group
	for rows.Next() {
		g, err := scanGroup(rows)
		if err != nil {
			return nil, fmt.Errorf("scan group: %w", err)
		}
		groups = append(groups, *g)
	}
	if groups == nil {
		groups = []model.Group{}
	}
	return groups, rows.Err()
}

func GetGroup(db *sql.DB, id string) (*model.Group, error) {
	row := db.QueryRow("SELECT "+groupColumns+" FROM groups WHERE id = ?", id)
	g, err := scanGroup(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get group: %w", err)
	}
	return g, nil
}

func InsertGroup(db *sql.DB, g *model.Group) error {
	now := model.Now()
	if g.CreatedAt == "" {
		g.CreatedAt = now
	}
	g.UpdatedAt = now

	_, err := db.Exec(`INSERT INTO groups (`+groupColumns+`)
		VALUES (?,?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, capture_id=excluded.capture_id,
			position=excluded.position, archived=excluded.archived,
			updated_at=excluded.updated_at`,
		g.ID, g.Name, g.CaptureID, g.Position, BoolToInt(g.Archived), g.CreatedAt, g.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert group: %w", err)
	}
	return nil
}

func UpdateGroup(db *sql.DB, id string, updates map[string]any) (*model.Group, error) {
	updates["updated_at"] = model.Now()
	setCols, args := buildUpdateSets(updates)
	args = append(args, id)

	_, err := db.Exec("UPDATE groups SET "+setCols+" WHERE id = ?", args...)
	if err != nil {
		return nil, fmt.Errorf("update group: %w", err)
	}
	return GetGroup(db, id)
}

func DeleteGroup(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM groups WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete group: %w", err)
	}
	return nil
}
