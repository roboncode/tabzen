// apps/extension/components/settings/SkillManager.tsx
import { createSignal, createResource, For, Show } from "solid-js";
import { Trash2, Plus, Star, StarOff, Pencil } from "lucide-solid";
import { getAllSkills, deleteCustomSkill, setSkillDefault } from "@/lib/chat/chat-skills";
import type { ChatSkill } from "@/lib/chat/chat-db";
import ChatSkillEditor from "@/components/detail/ChatSkillEditor";

export default function SkillManager() {
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [skills] = createResource(refreshKey, getAllSkills);
  const [editingSkill, setEditingSkill] = createSignal<ChatSkill | undefined>(undefined);
  const [showEditor, setShowEditor] = createSignal(false);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleToggleDefault(skill: ChatSkill) {
    await setSkillDefault(skill.id, !skill.isDefault);
    refresh();
  }

  async function handleDelete(skillId: string) {
    await deleteCustomSkill(skillId);
    refresh();
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-foreground">Chat Skills</h3>
          <p class="text-sm text-muted-foreground">Skills modify how the AI responds in chat conversations</p>
        </div>
        <button
          onClick={() => { setEditingSkill(undefined); setShowEditor(true); }}
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-violet-500 text-white hover:bg-violet-600 transition-colors"
        >
          <Plus size={12} />
          New Skill
        </button>
      </div>

      <Show when={skills()}>
        <div class="space-y-1">
          <For each={skills()}>
            {(skill: ChatSkill) => (
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-foreground flex items-center gap-1.5">
                    {skill.name}
                    <Show when={!skill.isBuiltin}>
                      <span class="text-xs text-muted-foreground/50">custom</span>
                    </Show>
                    <Show when={skill.isDefault}>
                      <span class="text-xs text-violet-400">default</span>
                    </Show>
                  </div>
                  <div class="text-xs text-muted-foreground/60 truncate">{skill.description}</div>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleDefault(skill)}
                    class="p-1 rounded text-muted-foreground hover:text-violet-400 transition-colors"
                    title={skill.isDefault ? "Remove from defaults" : "Set as default"}
                  >
                    <Show when={skill.isDefault} fallback={<StarOff size={14} />}>
                      <Star size={14} />
                    </Show>
                  </button>
                  <Show when={!skill.isBuiltin}>
                    <button
                      onClick={() => { setEditingSkill(skill); setShowEditor(true); }}
                      class="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      class="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={showEditor()}>
        <ChatSkillEditor
          skill={editingSkill()}
          onClose={() => setShowEditor(false)}
          onSaved={refresh}
        />
      </Show>
    </div>
  );
}
