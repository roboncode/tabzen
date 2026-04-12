package model

import (
	"encoding/json"
	"time"
)

type Page struct {
	ID               string   `json:"id"`
	URL              string   `json:"url"`
	Title            string   `json:"title"`
	Favicon          string   `json:"favicon"`
	OgTitle          *string  `json:"ogTitle"`
	OgDescription    *string  `json:"ogDescription"`
	OgImage          *string  `json:"ogImage"`
	MetaDescription  *string  `json:"metaDescription"`
	Creator          *string  `json:"creator"`
	CreatorAvatar    *string  `json:"creatorAvatar"`
	CreatorUrl       *string  `json:"creatorUrl"`
	PublishedAt      *string  `json:"publishedAt"`
	Tags             []string `json:"tags"`
	Notes            *string  `json:"notes"`
	ViewCount        int      `json:"viewCount"`
	LastViewedAt     *string  `json:"lastViewedAt"`
	CapturedAt       string   `json:"capturedAt"`
	SourceLabel      string   `json:"sourceLabel"`
	DeviceID         string   `json:"deviceId"`
	Archived         bool     `json:"archived"`
	Starred          bool     `json:"starred"`
	DeletedAt        *string  `json:"deletedAt"`
	GroupID          string   `json:"groupId"`
	ContentKey       *string  `json:"contentKey"`
	ContentType      *string  `json:"contentType"`
	ContentFetchedAt *string  `json:"contentFetchedAt"`
	ContentVersion   *int     `json:"contentVersion"`
	CreatedAt        string   `json:"createdAt"`
	UpdatedAt        string   `json:"updatedAt"`
}

func (p *Page) TagsJSON() string {
	if p.Tags == nil {
		return "[]"
	}
	b, _ := json.Marshal(p.Tags)
	return string(b)
}

func (p *Page) ParseTags(s string) {
	if s == "" || s == "null" {
		p.Tags = []string{}
		return
	}
	_ = json.Unmarshal([]byte(s), &p.Tags)
	if p.Tags == nil {
		p.Tags = []string{}
	}
}

func Now() string {
	return time.Now().UTC().Format(time.RFC3339)
}
