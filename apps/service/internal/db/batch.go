package db

import (
	"database/sql"
	"fmt"

	"tabzen-service/internal/model"
)

func BatchUpsert(database *sql.DB, req model.BatchRequest) (model.BatchResponse, error) {
	var resp model.BatchResponse

	tx, err := database.Begin()
	if err != nil {
		return resp, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := model.Now()

	// Groups first (referenced by pages)
	for _, g := range req.Groups {
		if g.CreatedAt == "" {
			g.CreatedAt = now
		}
		g.UpdatedAt = now
		_, err := tx.Exec(`INSERT INTO groups (`+groupColumns+`)
			VALUES (?,?,?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET
				name=excluded.name, capture_id=excluded.capture_id,
				position=excluded.position, archived=excluded.archived,
				updated_at=excluded.updated_at`,
			g.ID, g.Name, g.CaptureID, g.Position, BoolToInt(g.Archived), g.CreatedAt, g.UpdatedAt,
		)
		if err != nil {
			return resp, fmt.Errorf("upsert group %s: %w", g.ID, err)
		}
		resp.Groups++
	}

	// Captures (referenced by pages via source)
	for _, c := range req.Captures {
		if c.CreatedAt == "" {
			c.CreatedAt = now
		}
		_, err := tx.Exec(`INSERT INTO captures (`+captureColumns+`)
			VALUES (?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET
				captured_at=excluded.captured_at, source_label=excluded.source_label,
				tab_count=excluded.tab_count`,
			c.ID, c.CapturedAt, c.SourceLabel, c.TabCount, c.CreatedAt,
		)
		if err != nil {
			return resp, fmt.Errorf("upsert capture %s: %w", c.ID, err)
		}
		resp.Captures++
	}

	// Pages
	for _, p := range req.Pages {
		if p.CreatedAt == "" {
			p.CreatedAt = now
		}
		p.UpdatedAt = now
		if p.Tags == nil {
			p.Tags = []string{}
		}
		_, err := tx.Exec(`INSERT INTO pages (`+pageColumns+`)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET
				url=excluded.url, title=excluded.title, favicon=excluded.favicon,
				og_title=excluded.og_title, og_description=excluded.og_description,
				og_image=excluded.og_image, meta_description=excluded.meta_description,
				creator=excluded.creator, creator_avatar=excluded.creator_avatar,
				creator_url=excluded.creator_url, published_at=excluded.published_at,
				tags=excluded.tags, notes=excluded.notes, view_count=excluded.view_count,
				last_viewed_at=excluded.last_viewed_at, captured_at=excluded.captured_at,
				source_label=excluded.source_label, device_id=excluded.device_id,
				archived=excluded.archived, starred=excluded.starred,
				deleted_at=excluded.deleted_at, group_id=excluded.group_id,
				content_key=excluded.content_key, content_type=excluded.content_type,
				content_fetched_at=excluded.content_fetched_at,
				content_version=excluded.content_version,
				updated_at=excluded.updated_at`,
			p.ID, p.URL, p.Title, p.Favicon,
			p.OgTitle, p.OgDescription, p.OgImage,
			p.MetaDescription, p.Creator, p.CreatorAvatar, p.CreatorUrl,
			p.PublishedAt, p.TagsJSON(), p.Notes,
			p.ViewCount, p.LastViewedAt, p.CapturedAt, p.SourceLabel,
			p.DeviceID, BoolToInt(p.Archived), BoolToInt(p.Starred),
			p.DeletedAt, p.GroupID, p.ContentKey, p.ContentType,
			p.ContentFetchedAt, p.ContentVersion,
			p.CreatedAt, p.UpdatedAt,
		)
		if err != nil {
			return resp, fmt.Errorf("upsert page %s: %w", p.ID, err)
		}
		resp.Pages++
	}

	// Templates (referenced by documents)
	for _, t := range req.Templates {
		if t.CreatedAt == "" {
			t.CreatedAt = now
		}
		t.UpdatedAt = now
		_, err := tx.Exec(`INSERT INTO templates (`+templateColumns+`)
			VALUES (?,?,?,?,?,?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET
				name=excluded.name, prompt=excluded.prompt,
				is_builtin=excluded.is_builtin, default_prompt=excluded.default_prompt,
				is_enabled=excluded.is_enabled, sort_order=excluded.sort_order,
				model=excluded.model, updated_at=excluded.updated_at`,
			t.ID, t.Name, t.Prompt, BoolToInt(t.IsBuiltin),
			t.DefaultPrompt, BoolToInt(t.IsEnabled), t.SortOrder,
			t.Model, t.CreatedAt, t.UpdatedAt,
		)
		if err != nil {
			return resp, fmt.Errorf("upsert template %s: %w", t.ID, err)
		}
		resp.Templates++
	}

	// Documents last (references pages and templates)
	for _, d := range req.Documents {
		if d.CreatedAt == "" {
			d.CreatedAt = now
		}
		d.UpdatedAt = now
		_, err := tx.Exec(`INSERT INTO documents (`+documentColumns+`)
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
			return resp, fmt.Errorf("upsert document %s: %w", d.ID, err)
		}
		resp.Documents++
	}

	if err := tx.Commit(); err != nil {
		return resp, fmt.Errorf("commit transaction: %w", err)
	}

	return resp, nil
}
