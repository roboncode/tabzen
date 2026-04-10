/** Bidirectional mapping between URL slugs and internal section IDs */

const SLUG_TO_ID: Record<string, string> = {
  "content": "content",
  "custom": "custom",
  "summary": "builtin-summary",
  "key-points": "builtin-key-points",
  "action-items": "builtin-action-items",
  "eli5": "builtin-eli5",
  "products-mentions": "builtin-products-mentions",
  "sponsors": "builtin-sponsors",
  "social-posts": "builtin-social-posts",
};

const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_ID).map(([slug, id]) => [id, slug]),
);

/** Convert a URL slug to an internal section ID. Custom templates use `tmpl-<uuid>` format. */
export function slugToSectionId(slug: string | undefined): string {
  if (!slug) return "content";
  if (SLUG_TO_ID[slug]) return SLUG_TO_ID[slug];
  if (slug.startsWith("tmpl-")) return slug.slice(5);
  return "content";
}

/** Convert an internal section ID to a URL slug. */
export function sectionIdToSlug(id: string): string {
  if (ID_TO_SLUG[id]) return ID_TO_SLUG[id];
  return `tmpl-${id}`;
}
