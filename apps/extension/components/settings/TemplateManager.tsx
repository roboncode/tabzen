import { createSignal, createResource, For, Show } from "solid-js";
import { v4 as uuidv4 } from "uuid";
import { ChevronDown, ChevronRight, RotateCcw, Trash2, Plus, GripVertical } from "lucide-solid";
import { getAllTemplates, putTemplate, deleteTemplate } from "@/lib/db";
import { getDefaultPrompt } from "@/lib/templates";
import type { AITemplate } from "@/lib/types";

export default function TemplateManager() {
  const [templates, { refetch }] = createResource(getAllTemplates);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  const handleToggle = async (template: AITemplate) => {
    await putTemplate({ ...template, isEnabled: !template.isEnabled });
    refetch();
  };

  const handleSave = async (template: AITemplate, updates: Partial<AITemplate>) => {
    await putTemplate({ ...template, ...updates });
    refetch();
  };

  const handleReset = async (template: AITemplate) => {
    if (!template.defaultPrompt) return;
    await putTemplate({ ...template, prompt: template.defaultPrompt });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    if (expandedId() === id) setExpandedId(null);
    refetch();
  };

  const handleAdd = async () => {
    const sortOrder = (templates()?.length ?? 0) + 1;
    const template: AITemplate = {
      id: uuidv4(),
      name: "New Template",
      prompt: "",
      isBuiltin: false,
      defaultPrompt: null,
      isEnabled: true,
      sortOrder,
      model: null,
    };
    await putTemplate(template);
    refetch();
    setExpandedId(template.id);
  };

  const isModified = (template: AITemplate) =>
    template.isBuiltin && template.defaultPrompt !== null && template.prompt !== template.defaultPrompt;

  return (
    <div>
      <div class="space-y-1">
        <For each={templates()}>
          {(template) => (
            <div class="bg-muted/20 rounded-lg overflow-hidden">
              <div class="flex items-center gap-2 px-3 py-2.5">
                <GripVertical size={14} class="text-muted-foreground/30 flex-shrink-0 cursor-grab" />
                <button
                  class="flex-1 text-left text-sm text-foreground truncate"
                  onClick={() => setExpandedId(expandedId() === template.id ? null : template.id)}
                >
                  <span class="flex items-center gap-2">
                    {expandedId() === template.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {template.name}
                    <Show when={isModified(template)}>
                      <span class="text-[10px] text-amber-400/70 font-medium">modified</span>
                    </Show>
                  </span>
                </button>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={template.isEnabled}
                    onChange={() => handleToggle(template)}
                    class="sr-only peer"
                  />
                  <div class="w-8 h-4.5 bg-muted-foreground/20 peer-checked:bg-sky-500/50 rounded-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-foreground after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
                </label>
              </div>

              <Show when={expandedId() === template.id}>
                <div class="px-3 pb-3 space-y-3 border-t border-muted-foreground/5">
                  <div class="pt-3">
                    <label class="block text-xs text-muted-foreground mb-1">Name</label>
                    <input
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                      value={template.name}
                      onChange={(e) => handleSave(template, { name: e.currentTarget.value })}
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Prompt</label>
                    <textarea
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors resize-none"
                      rows={4}
                      maxLength={template.isBuiltin ? undefined : 500}
                      value={template.prompt}
                      onChange={(e) => handleSave(template, { prompt: e.currentTarget.value })}
                    />
                    <Show when={!template.isBuiltin}>
                      <div class="text-xs text-muted-foreground/40 mt-1 text-right">
                        {template.prompt.length}/500
                      </div>
                    </Show>
                  </div>
                  <div class="flex items-center gap-2">
                    <Show when={isModified(template)}>
                      <button
                        onClick={() => handleReset(template)}
                        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
                      >
                        <RotateCcw size={12} />
                        Reset to Default
                      </button>
                    </Show>
                    <Show when={!template.isBuiltin}>
                      <button
                        onClick={() => handleDelete(template.id)}
                        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors ml-auto"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
      <button
        onClick={handleAdd}
        class="flex items-center gap-1.5 mt-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
      >
        <Plus size={14} />
        Add Template
      </button>
    </div>
  );
}
