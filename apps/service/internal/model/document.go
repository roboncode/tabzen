package model

type Document struct {
	ID          string  `json:"id"`
	PageID      string  `json:"pageId"`
	TemplateID  string  `json:"templateId"`
	Content     string  `json:"content"`
	GeneratedAt string  `json:"generatedAt"`
	PromptUsed  string  `json:"promptUsed"`
	SourceHash  *string `json:"sourceHash"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}
