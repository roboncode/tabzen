import type { AIGroupSuggestion } from "./types";

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

export async function groupTabsWithAI(
  apiKey: string,
  model: string,
  tabs: { id: string; title: string; url: string; description: string | null }[],
): Promise<AIGroupSuggestion[]> {
  const tabList = tabs
    .map((t) => `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a tab organizer. Given a list of browser tabs, group them into meaningful categories. Return JSON with this exact structure:
{"groups": [{"groupName": "Category Name", "tabIds": ["id1", "id2"]}]}
Rules:
- Create 2-8 groups depending on tab diversity
- Group names should be descriptive but concise (2-4 words)
- Every tab must be assigned to exactly one group
- Group by topic/purpose, not by domain (unless domain IS the topic)
- If tabs are very similar, use a specific name (e.g., "React Tutorials" not "YouTube Videos")`,
    },
    { role: "user", content: `Group these tabs:\n${tabList}` },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.groups;
}

export async function aiSearch(
  apiKey: string,
  model: string,
  query: string,
  tabs: { id: string; title: string; url: string; description: string | null; notes: string | null }[],
): Promise<string[]> {
  const tabList = tabs
    .map(
      (t) =>
        `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}${t.notes ? ` [Notes: ${t.notes}]` : ""}`,
    )
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a search assistant for a tab collection. Given a natural language query and a list of saved tabs, return the IDs of tabs that match the query. Return JSON: {"matchingTabIds": ["id1", "id2"]}. Return an empty array if nothing matches. Rank by relevance — most relevant first.`,
    },
    { role: "user", content: `Query: "${query}"\n\nTabs:\n${tabList}` },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.matchingTabIds;
}
