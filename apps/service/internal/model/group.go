package model

type Group struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CaptureID string `json:"captureId"`
	Position  int    `json:"position"`
	Archived  bool   `json:"archived"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}
