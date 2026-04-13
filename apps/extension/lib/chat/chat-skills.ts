// apps/extension/lib/chat/chat-skills.ts
import { getChatDB, type ChatSkill } from "./chat-db";

import conciseRaw from "@/prompts/chat-skills/concise.md?raw";
import detailedRaw from "@/prompts/chat-skills/detailed.md?raw";
import eli5Raw from "@/prompts/chat-skills/eli5.md?raw";
import socraticRaw from "@/prompts/chat-skills/socratic.md?raw";
import cavemanRaw from "@/prompts/chat-skills/caveman.md?raw";

interface ParsedSkillFrontmatter {
  name: string;
  description: string;
  icon: string;
}

function parseSkillFile(raw: string): { frontmatter: ParsedSkillFrontmatter; prompt: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: { name: "Unknown", description: "", icon: "sparkles" }, prompt: raw.trim() };

  const fmBlock = fmMatch[1];
  const prompt = fmMatch[2].trim();

  const name = fmBlock.match(/name:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const description = fmBlock.match(/description:\s*(.+)/)?.[1]?.trim() ?? "";
  const icon = fmBlock.match(/icon:\s*(.+)/)?.[1]?.trim() ?? "sparkles";

  return { frontmatter: { name, description, icon }, prompt };
}

const BUILTIN_RAW: Record<string, string> = {
  "builtin-concise": conciseRaw,
  "builtin-detailed": detailedRaw,
  "builtin-eli5": eli5Raw,
  "builtin-socratic": socraticRaw,
  "builtin-caveman": cavemanRaw,
};

function buildBuiltinSkills(): ChatSkill[] {
  return Object.entries(BUILTIN_RAW).map(([id, raw]) => {
    const { frontmatter, prompt } = parseSkillFile(raw);
    return {
      id,
      name: frontmatter.name,
      description: frontmatter.description,
      icon: frontmatter.icon,
      prompt,
      isBuiltin: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
  });
}

let builtinSkillsCache: ChatSkill[] | null = null;

export function getBuiltinSkills(): ChatSkill[] {
  if (!builtinSkillsCache) {
    builtinSkillsCache = buildBuiltinSkills();
  }
  return builtinSkillsCache;
}

export async function getCustomSkills(): Promise<ChatSkill[]> {
  const db = await getChatDB();
  const all = await db.getAll("skills");
  return all.filter((s) => !s.isBuiltin);
}

export async function getAllSkills(): Promise<ChatSkill[]> {
  const builtins = getBuiltinSkills();
  const custom = await getCustomSkills();
  return [...builtins, ...custom];
}

export async function getDefaultSkillIds(): Promise<string[]> {
  const all = await getAllSkills();
  return all.filter((s) => s.isDefault).map((s) => s.id);
}

export async function saveCustomSkill(skill: ChatSkill): Promise<void> {
  const db = await getChatDB();
  await db.put("skills", { ...skill, isBuiltin: false });
}

export async function deleteCustomSkill(skillId: string): Promise<void> {
  const db = await getChatDB();
  await db.delete("skills", skillId);
}

export async function setSkillDefault(skillId: string, isDefault: boolean): Promise<void> {
  const builtins = getBuiltinSkills();
  const builtin = builtins.find((s) => s.id === skillId);
  if (builtin) {
    const db = await getChatDB();
    await db.put("skills", { ...builtin, isDefault });
    return;
  }

  const db = await getChatDB();
  const existing = await db.get("skills", skillId);
  if (existing) {
    existing.isDefault = isDefault;
    await db.put("skills", existing);
  }
}

export function getSkillById(skillId: string, allSkills: ChatSkill[]): ChatSkill | undefined {
  return allSkills.find((s) => s.id === skillId);
}

export function buildSkillPrompt(activeSkillIds: string[], allSkills: ChatSkill[]): string {
  if (activeSkillIds.length === 0) return "";

  const prompts = activeSkillIds
    .map((id) => getSkillById(id, allSkills))
    .filter((s): s is ChatSkill => s !== undefined)
    .map((s) => s.prompt);

  if (prompts.length === 0) return "";

  return "\n\n## Active Skills\n\n" + prompts.join("\n\n---\n\n");
}
