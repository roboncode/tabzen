// apps/extension/components/detail/ChatSkillEditor.tsx
import { createSignal, Show } from "solid-js";
import { X } from "lucide-solid";
import type { ChatSkill } from "@/lib/chat/chat-db";
import { saveCustomSkill } from "@/lib/chat/chat-skills";

interface ChatSkillEditorProps {
  skill?: ChatSkill;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChatSkillEditor(props: ChatSkillEditorProps) {
  const [name, setName] = createSignal(props.skill?.name ?? "");
  const [description, setDescription] = createSignal(props.skill?.description ?? "");
  const [prompt, setPrompt] = createSignal(props.skill?.prompt ?? "");
  const [saving, setSaving] = createSignal(false);

  async function handleSave() {
    if (!name().trim() || !prompt().trim()) return;
    setSaving(true);

    const skill: ChatSkill = {
      id: props.skill?.id ?? `custom-${crypto.randomUUID()}`,
      name: name().trim(),
      description: description().trim(),
      icon: "sparkles",
      prompt: prompt().trim(),
      isBuiltin: false,
      isDefault: props.skill?.isDefault ?? false,
      createdAt: props.skill?.createdAt ?? new Date().toISOString(),
    };

    await saveCustomSkill(skill);
    setSaving(false);
    props.onSaved();
    props.onClose();
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
          <span class="text-sm font-semibold text-foreground">
            {props.skill ? "Edit Skill" : "Create Skill"}
          </span>
          <button onClick={props.onClose} class="p-1 rounded-md text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., Code Reviewer"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Short description of what this skill does"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Prompt</label>
            <textarea
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 min-h-[120px] resize-y"
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              placeholder="Instructions for the AI when this skill is active..."
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 px-4 py-3 bg-muted/10">
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name().trim() || !prompt().trim() || saving()}
            class="px-3 py-1.5 rounded-lg text-sm bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {saving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
