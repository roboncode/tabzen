import { For, Show } from "solid-js";
import type { AITemplate, AIDocument } from "@/lib/types";
import { Plus, EyeOff } from "lucide-solid";

interface DocumentNavProps {
  templates: AITemplate[];
  documents: AIDocument[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddCustom: () => void;
  onHideTemplate?: (template: AITemplate) => void;
}

export default function DocumentNav(props: DocumentNavProps) {
  const builtinTemplates = () => props.templates.filter((t) => t.isBuiltin);
  const customTemplates = () => props.templates.filter((t) => !t.isBuiltin);

  const navItem = (template: AITemplate) => {
    const hasDoc = () =>
      props.documents.some((d) => d.templateId === template.id);
    return (
      <div class="group flex items-center gap-1">
        <button
          class={`flex-1 text-left text-sm py-1 truncate transition-colors duration-200 ${
            props.activeTab === template.id
              ? "text-sky-400 font-medium"
              : hasDoc()
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
          onClick={() => props.onTabChange(template.id)}
          title={template.name}
        >
          {template.name}
        </button>
        <Show when={props.onHideTemplate}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onHideTemplate!(template);
            }}
            class="flex-shrink-0 p-1.5 rounded-md cursor-pointer text-muted-foreground/0 group-hover:text-muted-foreground/30 hover:!text-muted-foreground hover:!bg-muted/30 transition-colors"
            title={`Hide ${template.name}`}
          >
            <EyeOff size={14} />
          </button>
        </Show>
      </div>
    );
  };

  return (
    <nav class="pb-8">
      {/* App name — matches header bar height */}
      <div class="h-16 flex items-center px-10">
        <span class="text-sm font-bold text-foreground">Tab Zen</span>
      </div>
      <div class="mx-10 border-b-3 border-muted-foreground/10" />

      {/* Nav items */}
      <div class="flex flex-col gap-0.5 px-10 pt-6">
        <button
          class={`block w-full text-left text-sm py-1 transition-colors duration-200 ${
            props.activeTab === "content"
              ? "text-sky-400 font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => props.onTabChange("content")}
        >
          Content
        </button>

        {/* Built-in templates */}
        <For each={builtinTemplates()}>
          {(template) => navItem(template)}
        </For>

        {/* Divider + custom templates */}
        <Show when={customTemplates().length > 0}>
          <div class="my-3 border-b border-muted-foreground/10" />
          <For each={customTemplates()}>
            {(template) => navItem(template)}
          </For>
        </Show>

        {/* Add custom */}
        <div class={customTemplates().length === 0 ? "mt-3 pt-3 border-t border-muted-foreground/10" : ""}>
          <button
            class={`block w-full text-left text-sm py-1 transition-colors duration-200 ${
              props.activeTab === "custom"
                ? "text-sky-400 font-medium"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            }`}
            onClick={props.onAddCustom}
          >
            <Plus size={12} class="inline -mt-px mr-1" />
            Custom
          </button>
        </div>
      </div>
    </nav>
  );
}
