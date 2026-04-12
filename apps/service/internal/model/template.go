package model

type Template struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Prompt        string  `json:"prompt"`
	IsBuiltin     bool    `json:"isBuiltin"`
	DefaultPrompt *string `json:"defaultPrompt"`
	IsEnabled     bool    `json:"isEnabled"`
	SortOrder     int     `json:"sortOrder"`
	Model         *string `json:"model"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
}
