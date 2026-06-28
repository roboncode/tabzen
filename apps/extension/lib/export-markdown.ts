import { zip, strToU8 } from "fflate";
import { getAllData } from "./db";
import type { Page } from "./types";

// Characters illegal in file names on common OSes, plus ASCII control chars.
const ILLEGAL_FILENAME_CHARS = /[/\\:*?"<>|\x00-\x1f]/g;

/** Format milliseconds as m:ss (or h:mm:ss) for transcript lines. */
function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Make a string safe to use as a file or folder name across OSes. */
export function sanitizeFilename(name: string, fallback = "untitled"): string {
  const cleaned = (name || "")
    .replace(ILLEGAL_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "") // no trailing dots (Windows)
    .slice(0, 120)
    .trim();
  return cleaned || fallback;
}

/** Quote/escape a string for a YAML frontmatter scalar. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Build a single page's Markdown document: YAML frontmatter (read by Obsidian,
 * Logseq, etc.) followed by notes, the transcript, and the extracted article
 * content — whichever are present.
 */
export function buildPageMarkdown(page: Page): string {
  const title = page.ogTitle || page.title || "Untitled";
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: ${yamlString(title)}`);
  lines.push(`url: ${yamlString(page.url)}`);
  if (page.creator) lines.push(`creator: ${yamlString(page.creator)}`);
  if (page.publishedAt) lines.push(`published: ${yamlString(page.publishedAt)}`);
  lines.push(`captured: ${yamlString(page.capturedAt)}`);
  if (page.tags?.length) {
    lines.push(`tags: [${page.tags.map((t) => yamlString(t)).join(", ")}]`);
  }
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`[${page.url}](${page.url})`);
  lines.push("");

  const summary = page.ogDescription || page.metaDescription;
  if (summary) {
    lines.push(`> ${summary.trim()}`);
    lines.push("");
  }

  if (page.notes) {
    lines.push("## Notes", "", page.notes.trim(), "");
  }

  if (page.transcript?.length) {
    lines.push("## Transcript", "");
    for (const seg of page.transcript) {
      lines.push(`- \`[${formatTimestamp(seg.startMs)}]\` ${seg.text.trim()}`);
    }
    lines.push("");
  }

  if (page.content) {
    lines.push("## Content", "", page.content.trim(), "");
  }

  return lines.join("\n");
}

/**
 * Export all non-deleted pages as a ZIP of Markdown files, one per page, in
 * folders named after their collection. One-way export for use in other tools
 * (Obsidian, Notion, …) — not a restore format; use the gzip backup for that.
 */
export async function exportAsMarkdownZip(): Promise<Blob> {
  const { pages, groups } = await getAllData();
  const groupName = new Map<string, string>();
  for (const g of groups) groupName.set(g.id, g.name);

  const files: Record<string, Uint8Array> = {};
  const usedPaths = new Set<string>();

  for (const page of pages) {
    if (page.deletedAt) continue;
    const folder = sanitizeFilename(groupName.get(page.groupId) || "Ungrouped", "Ungrouped");
    const base = sanitizeFilename(page.ogTitle || page.title || "untitled");
    let path = `${folder}/${base}.md`;
    let n = 2;
    while (usedPaths.has(path.toLowerCase())) {
      path = `${folder}/${base} (${n++}).md`;
    }
    usedPaths.add(path.toLowerCase());
    files[path] = strToU8(buildPageMarkdown(page));
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out))),
  );
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}
