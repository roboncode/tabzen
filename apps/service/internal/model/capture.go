package model

type Capture struct {
	ID          string `json:"id"`
	CapturedAt  string `json:"capturedAt"`
	SourceLabel string `json:"sourceLabel"`
	TabCount    int    `json:"tabCount"`
	CreatedAt   string `json:"createdAt"`
}
