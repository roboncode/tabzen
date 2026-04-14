import { createSignal, createResource, For, Show } from "solid-js";
import { RotateCcw, Trash2, Plus, Pencil, GripVertical } from "lucide-solid";
import { getAllTemplates, putTemplate, deleteTemplate } from "@/lib/db";
import { resetBuiltinTemplates } from "@/lib/templates";
import type { AITemplate } from "@/lib/types";
import TemplateEditor from "./TemplateEditor";

export default function TemplateManager() {
  const [templates, { refetch }] = createResource(getAllTemplates);
  const [editingTemplate, setEditingTemplate] = createSignal<AITemplate | undefined>(undefined);
  const [showEditor, setShowEditor] = createSignal(false);

  const handleToggle = async (template: AITemplate) => {
    await putTemplate({ ...template, isEnabled: !template.isEnabled });
    refetch();
  };

  const handleSaved = async (template: AITemplate) => {
    await putTemplate(template);
    refetch();
  };

  const handleReset = async (template: AITemplate) => {
    if (!template.defaultPrompt) return;
    await putTemplate({ ...template, prompt: template.defaultPrompt });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    refetch();
  };

  const handleResetDefaults = async () => {
    await resetBuiltinTemplates();
    refetch();
  };

  const isModified = (template: AITemplate) =>
    template.isBuiltin && template.defaultPrompt !== null && template.prompt !== template.defaultPrompt;

  return (
    <div>
      <div class="flex items-center justify-end mb-3">
        <button
          class="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md hover:text-foreground hover:bg-muted transition-colors"
          onClick={handleResetDefaults}
        >
          Reset to defaults
        </button>
      </div>

      <div class="space-y-1">
        <For each={templates()}>
          {(template) => (
            <div
              class="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group cursor-pointer"
              onClick={() => { setEditingTemplate(template); setShowEditor(true); }}
            >
              <GripVertical
                size={14}
                class="text-muted-foreground/30 flex-shrink-0 cursor-grab"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              />
              <div class="flex-1 min-w-0">
                <span class="text-sm text-foreground truncate flex items-center gap-1.5">
                  {template.name}
                  <Show when={template.isBuiltin}>
                    <span class="text-[10px] text-muted-foreground/40">built-in</span>
                  </Show>
                  <Show when={isModified(template)}>
                    <span class="text-[10px] text-amber-400/70 font-medium">modified</span>
                  </Show>
                </span>
              </div>
              <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              >
                <Show when={isModified(template)}>
                  <button
                    onClick={() => handleReset(template)}
                    class="p-1 rounded text-amber-400/70 hover:text-amber-400 transition-colors"
                    title="Reset to default"
                  >
                    <RotateCcw size={14} />
                  </button>
                </Show>
                <Show when={!template.isBuiltin}>
                  <button
                    onClick={() => handleDelete(template.id)}
                    class="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </Show>
              </div>
              <label
                class="relative inline-flex items-center cursor-pointer flex-shrink-0"
                onClick={(e: MouseEvent) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={template.isEnabled}
                  onChange={() => handleToggle(template)}
                  class="sr-only peer"
                />
                <div class="w-8 h-4.5 bg-muted-foreground/20 peer-checked:bg-sky-500/50 rounded-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-foreground after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
              </label>
            </div>
          )}
        </For>
      </div>
      <button
        onClick={() => { setEditingTemplate(undefined); setShowEditor(true); }}
        class="flex items-center gap-1.5 mt-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
      >
        <Plus size={14} />
        Add Template
      </button>

      <Show when={showEditor()}>
        <TemplateEditor
          template={editingTemplate()}
          onClose={() => setShowEditor(false)}
          onSaved={handleSaved}
        />
      </Show>
    </div>
  );
}
