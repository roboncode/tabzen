// apps/extension/components/detail/ChatSkillPicker.tsx
import { createSignal, createResource, Show, For } from "solid-js";
import { Sparkles, Check } from "lucide-solid";
import { getAllSkills } from "@/lib/chat/chat-skills";
import type { ChatSkill } from "@/lib/chat/chat-db";

interface ChatSkillPickerProps {
  activeSkillIds: string[];
  onToggleSkill: (skillId: string) => void;
}

export default function ChatSkillPicker(props: ChatSkillPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [skills] = createResource(getAllSkills);

  const activeCount = () => props.activeSkillIds.length;

  return (
    <div class="relative">
      <button
        onClick={() => setOpen(!open())}
        class={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
          activeCount() > 0
            ? "text-violet-400 bg-violet-400/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        title={activeCount() > 0 ? `${activeCount()} skill(s) active` : "Add skills"}
      >
        <Sparkles size={14} />
        <Show when={activeCount() > 0}>
          <span class="text-xs">{activeCount()}</span>
        </Show>
      </button>

      <Show when={open()}>
        {/* Backdrop */}
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />

        {/* Dropdown */}
        <div class="absolute bottom-full left-0 mb-2 z-50 w-64 bg-card rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div class="px-3 py-2 bg-muted/30 text-xs font-semibold text-foreground">
            Skills
          </div>
          <div class="max-h-64 overflow-y-auto">
            <Show when={skills()} fallback={<div class="px-3 py-4 text-xs text-muted-foreground">Loading...</div>}>
              <For each={skills()}>
                {(skill: ChatSkill) => {
                  const isActive = () => props.activeSkillIds.includes(skill.id);
                  return (
                    <button
                      class={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors ${
                        isActive() ? "bg-violet-400/5" : ""
                      }`}
                      onClick={() => {
                        props.onToggleSkill(skill.id);
                      }}
                    >
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-foreground flex items-center gap-1.5">
                          {skill.name}
                          <Show when={!skill.isBuiltin}>
                            <span class="text-xs text-muted-foreground/50">custom</span>
                          </Show>
                        </div>
                        <div class="text-xs text-muted-foreground/60 truncate">{skill.description}</div>
                      </div>
                      <Show when={isActive()}>
                        <Check size={14} class="text-violet-400 flex-shrink-0" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
