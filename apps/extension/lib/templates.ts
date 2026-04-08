import { v4 as uuidv4 } from "uuid";
import { getAllTemplates, putTemplates } from "./db";
import type { AITemplate } from "./types";

// Import prompt files as raw text
import summaryPrompt from "@/prompts/summary.md?raw";
import keyPointsPrompt from "@/prompts/key-points.md?raw";
import actionItemsPrompt from "@/prompts/action-items.md?raw";
import eli5Prompt from "@/prompts/eli5.md?raw";
import productsMentionsPrompt from "@/prompts/products-mentions.md?raw";

interface BuiltinDef {
  name: string;
  prompt: string;
}

const BUILTIN_TEMPLATES: BuiltinDef[] = [
  { name: "Summary", prompt: summaryPrompt.trim() },
  { name: "Key Points", prompt: keyPointsPrompt.trim() },
  { name: "Action Items", prompt: actionItemsPrompt.trim() },
  { name: "ELI5", prompt: eli5Prompt.trim() },
  { name: "Products & Mentions", prompt: productsMentionsPrompt.trim() },
];

export async function seedTemplatesIfNeeded(): Promise<void> {
  const existing = await getAllTemplates();
  if (existing.length > 0) return;

  const templates: AITemplate[] = BUILTIN_TEMPLATES.map((def, i) => ({
    id: uuidv4(),
    name: def.name,
    prompt: def.prompt,
    isBuiltin: true,
    defaultPrompt: def.prompt,
    isEnabled: true,
    sortOrder: i,
    model: null,
  }));

  await putTemplates(templates);
}

export function getDefaultPrompt(templateName: string): string | null {
  const def = BUILTIN_TEMPLATES.find((d) => d.name === templateName);
  return def?.prompt ?? null;
}
