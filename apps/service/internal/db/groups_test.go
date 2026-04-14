package db

import (
	"testing"

	"tabzen-service/internal/model"
)

func TestInsertAndListGroups(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	g1 := &model.Group{ID: "g1", Name: "Work", CaptureID: "c1", Position: 1}
	g2 := &model.Group{ID: "g2", Name: "Personal", CaptureID: "c1", Position: 0}

	if err := InsertGroup(database, g1); err != nil {
		t.Fatal(err)
	}
	if err := InsertGroup(database, g2); err != nil {
		t.Fatal(err)
	}

	groups, err := ListGroups(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 {
		t.Fatalf("len = %d, want 2", len(groups))
	}
	// Should be ordered by position ASC.
	if groups[0].Name != "Personal" {
		t.Errorf("first group = %q, want Personal (position 0)", groups[0].Name)
	}

	// Get by ID.
	got, err := GetGroup(database, "g1")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.Name != "Work" {
		t.Errorf("GetGroup = %v, want Work", got)
	}
}

func TestDeleteGroup(t *testing.T) {
	database, err := OpenTest()
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	g := &model.Group{ID: "g1", Name: "Work", CaptureID: "c1"}
	if err := InsertGroup(database, g); err != nil {
		t.Fatal(err)
	}

	if err := DeleteGroup(database, "g1"); err != nil {
		t.Fatal(err)
	}

	groups, err := ListGroups(database)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 0 {
		t.Errorf("len = %d, want 0 after delete", len(groups))
	}
}
