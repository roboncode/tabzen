import { createSignal } from "solid-js";
import { X } from "lucide-solid";
import type { AITemplate } from "@/lib/types";

interface TemplateEditorProps {
  template?: AITemplate;
  onClose: () => void;
  onSaved: (template: AITemplate) => void;
}

export default function TemplateEditor(props: TemplateEditorProps) {
  const [name, setName] = createSignal(props.template?.name ?? "");
  const [prompt, setPrompt] = createSignal(props.template?.prompt ?? "");
  const [saving, setSaving] = createSignal(false);

  const maxLength = props.template?.isBuiltin ? undefined : 500;
  const isEdit = !!props.template;

  function handleSave() {
    if (!name().trim() || !prompt().trim()) return;
    setSaving(true);

    const template: AITemplate = {
      id: props.template?.id ?? crypto.randomUUID(),
      name: name().trim(),
      prompt: prompt().trim(),
      isBuiltin: props.template?.isBuiltin ?? false,
      defaultPrompt: props.template?.defaultPrompt ?? null,
      isEnabled: props.template?.isEnabled ?? true,
      sortOrder: props.template?.sortOrder ?? 999,
      model: props.template?.model ?? null,
    };

    props.onSaved(template);
    props.onClose();
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
          <span class="text-sm font-semibold text-foreground">
            {isEdit ? "Edit Template" : "Create Template"}
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
              placeholder="e.g., Meeting Notes"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Prompt</label>
            <textarea
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 min-h-[120px] resize-y"
              maxLength={maxLength}
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              placeholder="Instructions for generating this document from the page content..."
            />
            {maxLength && (
              <div class="text-xs text-muted-foreground/40 mt-1 text-right">
                {prompt().length}/{maxLength}
              </div>
            )}
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
            class="px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving() ? "Saving..." : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
