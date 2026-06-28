import type { AIGroupSuggestion } from "./types";
import type { TranscriptSegment } from "@tab-zen/shared";
import type { TabFolderAssignment } from "@/lib/bookmark-plan";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "chrome-extension://tab-zen",
      "X-Title": "Tab Zen",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function groupPagesWithAI(
  apiKey: string,
  model: string,
  pages: { id: string; title: string; url: string; description: string | null }[],
): Promise<AIGroupSuggestion[]> {
  const pageList = pages
    .map((t) => `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a page organizer. Given a list of saved pages, group them into meaningful categories. Return JSON with this exact structure:
{"groups": [{"groupName": "Category Name", "pageIds": ["id1", "id2"]}]}
Rules:
- Create 2-8 groups depending on page diversity
- Group names should be descriptive but concise (2-4 words)
- Every page must be assigned to exactly one group
- Group by topic/purpose, not by domain (unless domain IS the topic)
- If pages are very similar, use a specific name (e.g., "React Tutorials" not "YouTube Videos")`,
    },
    { role: "user", content: `Group these pages:\n${pageList}` },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.groups;
}

export async function aiSearch(
  apiKey: string,
  model: string,
  query: string,
  pages: { id: string; title: string; url: string; description: string | null; notes: string | null }[],
): Promise<string[]> {
  const pageList = pages
    .map(
      (t) =>
        `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}${t.notes ? ` [Notes: ${t.notes}]` : ""}`,
    )
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a search assistant for a page collection. Given a natural language query and a list of saved pages, return the IDs of pages that match the query. Return JSON: {"matchingPageIds": ["id1", "id2"]}. Return an empty array if nothing matches. Rank by relevance — most relevant first.`,
    },
    { role: "user", content: `Query: "${query}"\n\nPages:\n${pageList}` },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.matchingPageIds;
}

export async function generateDocument(
  apiKey: string,
  model: string,
  templatePrompt: string,
  content: string,
  contentType: "transcript" | "markdown",
): Promise<string> {
  const contentLabel = contentType === "transcript" ? "video transcript" : "article";
  const processedPrompt = templatePrompt.replace(/\{\{contentType\}\}/g, contentLabel);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: processedPrompt,
    },
    {
      role: "user",
      content,
    },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "chrome-extension://tab-zen",
      "X-Title": "Tab Zen",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function generateTags(
  apiKey: string,
  model: string,
  pages: { id: string; title: string; url: string; description: string | null }[],
  existingTags?: string[],
): Promise<{ id: string; tags: string[] }[]> {
  const pageList = pages
    .map((t) => `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a content tagger. Given a list of saved pages, generate 2-5 relevant hashtags for each page. Return JSON: {"tags": [{"id": "page-id", "tags": ["tag1", "tag2"]}]}
Rules:
- Tags should be lowercase, no spaces, no # prefix
- Use specific descriptive tags (e.g., "react", "server-components", "tutorial")
- Avoid generic tags like "video", "website", "article"
- Tags should help categorize content by topic, technology, or theme
- ${existingTags && existingTags.length > 0 ? `Prefer reusing these existing tags when appropriate: ${existingTags.join(", ")}` : "Create descriptive, specific tags"}
- Reuse the same tag across pages when the content overlaps`,
    },
    { role: "user", content: `Tag these pages:\n${pageList}` },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.tags;
}

export async function generateChapters(
  apiKey: string,
  model: string,
  segments: TranscriptSegment[],
): Promise<{ title: string; startMs: number }[]> {
  const lines: string[] = [];
  for (const seg of segments) {
    const totalSec = Math.floor(seg.startMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const ts = `${m}:${s.toString().padStart(2, "0")}`;
    lines.push(`[${ts} ms=${seg.startMs}] ${seg.text}`);
  }
  const transcriptText = lines.join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a video chapter generator. Given a timestamped transcript, identify 4-10 topic shifts and assign a short chapter title to each. Each line has a display timestamp and an ms= value in milliseconds. Use the ms= value for startMs in your response. Return JSON: {"chapters": [{"title": "Chapter Title", "startMs": 0}, ...]}
Rules:
- The first chapter must start at startMs: 0
- Chapter titles should be 2-5 words, descriptive of the topic
- Chapters mark genuine topic shifts, not arbitrary time splits
- Fewer chapters for short videos, more for long ones
- startMs must use the exact ms= values from the transcript lines
- Sort chapters by startMs ascending`,
    },
    { role: "user", content: transcriptText },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.chapters;
}

// ---------------------------------------------------------------------------
// Bookmark organiser: groupTabsForBookmarks + parseBookmarkAssignments
// ---------------------------------------------------------------------------

/**
 * Parse the raw JSON string returned by the model into `TabFolderAssignment[]`.
 *
 * Validation rules:
 * - Content must be valid JSON that parses to an object with an `assignments` array.
 * - Each entry must have a string `url` and a string `folder`; malformed entries are
 *   dropped silently.
 * - Missing or non-array `assignments` key throws.
 *
 * Kept as a pure, exported function so it can be unit-tested independently of
 * the private `callOpenRouter` helper.
 */
export function parseBookmarkAssignments(content: string): TabFolderAssignment[] {
  // JSON.parse throws on invalid input — let it propagate
  const parsed: unknown = JSON.parse(content);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("parseBookmarkAssignments: expected a JSON object at root");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.assignments)) {
    throw new Error(
      "parseBookmarkAssignments: response missing 'assignments' array",
    );
  }

  const results: TabFolderAssignment[] = [];
  for (const entry of obj.assignments) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).url === "string" &&
      typeof (entry as Record<string, unknown>).folder === "string"
    ) {
      const e = entry as { url: string; folder: string };
      results.push({ url: e.url, folder: e.folder });
    }
    // silently drop malformed entries
  }

  return results;
}

/**
 * Call the OpenRouter AI to assign each open tab to a named bookmark folder.
 *
 * Passes `existingFolderNames` so the model can reuse existing folder names
 * when a tab clearly belongs to one of them, reducing folder proliferation on
 * re-runs.
 *
 * Throws when the model returns unparseable JSON or the response is
 * structurally invalid.  The caller (background.ts) is expected to catch and
 * fall back to the deterministic path.
 */
export async function groupTabsForBookmarks(
  apiKey: string,
  model: string,
  tabs: { title: string; url: string }[],
  existingFolderNames: string[],
): Promise<TabFolderAssignment[]> {
  const tabList = tabs
    .map((t) => `- "${t.title}" (${t.url})`)
    .join("\n");

  const folderHint =
    existingFolderNames.length > 0
      ? `\nExisting folder names (prefer reusing these when a tab clearly belongs there): ${existingFolderNames.join(", ")}`
      : "";

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a bookmark organiser. Given a list of open browser tabs, assign each tab to a named bookmark folder.${folderHint}
Rules:
- Prefer reusing an existing folder name when the tab clearly belongs there.
- Otherwise create a short, descriptive folder name (2–4 words).
- Every tab must appear exactly once in the output.
- Return JSON with this exact structure: {"assignments": [{"url": "...", "folder": "..."}]}`,
    },
    { role: "user", content: `Assign these tabs to folders:\n${tabList}` },
  ];

  const content = await callOpenRouter(apiKey, model, messages);
  return parseBookmarkAssignments(content);
}
