import { getAllTemplates, putTemplates } from "./db";
import type { AITemplate } from "./types";

// Import prompt files as raw text
import summaryPrompt from "@/prompts/summary.md?raw";
import keyPointsPrompt from "@/prompts/key-points.md?raw";
import actionItemsPrompt from "@/prompts/action-items.md?raw";
import eli5Prompt from "@/prompts/eli5.md?raw";
import productsMentionsPrompt from "@/prompts/products-mentions.md?raw";
import socialPostsPrompt from "@/prompts/social-posts.md?raw";

interface BuiltinDef {
  id: string;
  name: string;
  prompt: string;
}

const BUILTIN_TEMPLATES: BuiltinDef[] = [
  { id: "builtin-summary", name: "Summary", prompt: summaryPrompt.trim() },
  { id: "builtin-key-points", name: "Key Points", prompt: keyPointsPrompt.trim() },
  { id: "builtin-action-items", name: "Action Items", prompt: actionItemsPrompt.trim() },
  { id: "builtin-eli5", name: "Simplified", prompt: eli5Prompt.trim() },
  { id: "builtin-products-mentions", name: "Products & Mentions", prompt: productsMentionsPrompt.trim() },
  { id: "builtin-social-posts", name: "Social Posts", prompt: socialPostsPrompt.trim() },
];

export async function seedTemplatesIfNeeded(): Promise<void> {
  const existing = await getAllTemplates();

  // Rename ELI5 → Simplified for existing installs
  const eli5 = existing.find((t) => t.id === "builtin-eli5" && t.name !== "Simplified");
  if (eli5) {
    eli5.name = "Simplified";
    await putTemplates([eli5]);
  }

  // Add Social Posts for existing installs that don't have it
  if (!existing.find((t) => t.id === "builtin-social-posts")) {
    const socialDef = BUILTIN_TEMPLATES.find((d) => d.id === "builtin-social-posts")!;
    await putTemplates([{
      id: socialDef.id,
      name: socialDef.name,
      prompt: socialDef.prompt,
      isBuiltin: true,
      defaultPrompt: socialDef.prompt,
      isEnabled: true,
      sortOrder: existing.length,
      model: null,
    }]);
  }

  if (existing.length > 0) return;

  const templates: AITemplate[] = BUILTIN_TEMPLATES.map((def, i) => ({
    id: def.id,
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
