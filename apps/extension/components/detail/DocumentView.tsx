import { createSignal, createEffect, Show } from "solid-js";
import { Copy, Check, Trash2 } from "lucide-solid";
import { getSkeletonForTemplate } from "./DocumentSkeletons";
import PromptViewer from "./PromptViewer";

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  "builtin-key-points": "Extracts the most important ideas, arguments, and facts as a numbered list with short titles and descriptions, ordered by importance.",
  "builtin-action-items": "Pulls out concrete, actionable tasks and organizes them by priority into \"Do Now\" and \"Do Later\" groups with time estimates.",
  "builtin-summary": "Creates an editorial-style summary that captures the key narrative, arguments, and conclusions in a few paragraphs.",
  "builtin-eli5": "Breaks down complex topics into plain language using simple analogies, explains how things work, why they matter, and defines key concepts.",
  "builtin-products-mentions": "Lists all products, tools, services, and people mentioned with links, descriptions, and context for how they were referenced.",
  "builtin-social-posts": "Generates social media posts that position you as a subject matter expert. Choose your platform, length, and tone.",
};
import { marked } from "marked";
import type { AITemplate, AIDocument } from "@/lib/types";

interface DocumentViewProps {
  template: AITemplate;
  document: AIDocument | undefined;
  generating: boolean;
  stale?: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onDelete?: () => void;
  onUpdatePrompt?: (prompt: string) => void;
}

function applyDropCaps(container: HTMLElement) {
  const allP = container.querySelectorAll<HTMLParagraphElement>(":scope > p");
  const targets: HTMLParagraphElement[] = [];

  for (let i = 0; i < allP.length; i++) {
    const p = allP[i];
    if (i === 0) {
      targets.push(p);
      continue;
    }
    const prev = p.previousElementSibling;
    if (prev && prev.tagName === "BLOCKQUOTE") {
      targets.push(p);
    }
  }

  for (const p of targets) {
    const textContent = p.textContent?.trim();
    if (!textContent) continue;
    const firstChar = textContent[0];
    if (!firstChar || firstChar !== firstChar.toUpperCase() || firstChar === firstChar.toLowerCase()) continue;

    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const firstTextNode = walker.nextNode();
    if (!firstTextNode || !firstTextNode.textContent) continue;

    const nodeText = firstTextNode.textContent;
    const charIdx = nodeText.indexOf(firstChar);
    if (charIdx === -1) continue;

    const before = nodeText.slice(0, charIdx);
    const after = nodeText.slice(charIdx + 1);

    const dropCap = document.createElement("span");
    dropCap.className = "float-left text-[2.5rem] leading-[1] font-semibold text-foreground mr-2 mt-0.5";
    dropCap.textContent = firstChar;

    const parent = firstTextNode.parentNode!;
    if (before) parent.insertBefore(document.createTextNode(before), firstTextNode);
    parent.insertBefore(dropCap, firstTextNode);
    firstTextNode.textContent = after;
  }
}

export default function DocumentView(props: DocumentViewProps) {
  const [copied, setCopied] = createSignal(false);
  let contentRef: HTMLDivElement | undefined;

  const isCustom = () => !props.template.isBuiltin;

  const htmlContent = () => {
    if (!props.document?.content) return "";
    return marked.parse(props.document.content, { async: false }) as string;
  };

  createEffect(() => {
    const html = htmlContent();
    if (!html || !contentRef) return;
    requestAnimationFrame(() => {
      if (contentRef) applyDropCaps(contentRef);
    });
  });

  const handleCopy = () => {
    if (!props.document?.content) return;
    navigator.clipboard.writeText(props.document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="px-2 pb-12">
      {/* Title bar — always visible */}
      <div class="flex items-center gap-2 mb-6">
        <h2 class="text-xl font-semibold text-foreground">{props.template.name}</h2>
        <Show when={!props.generating && props.document}>
          <div class="flex items-center gap-1 ml-auto">
            <button
              onClick={handleCopy}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              {copied() ? <Check size={12} /> : <Copy size={12} />}
              {copied() ? "Copied" : "Copy"}
            </button>
            <Show when={isCustom() && props.onDelete}>
              <button
                onClick={props.onDelete}
                class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Prompt viewer/editor */}
      <Show when={!props.generating}>
        <PromptViewer
          template={props.template}
          onUpdatePrompt={props.onUpdatePrompt}
        />
      </Show>

      {/* Stale indicator — prompt or content changed since last generation */}
      <Show when={props.stale && props.document && !props.generating}>
        <div class="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-sky-500/10 mb-4">
          <span class="text-sm text-sky-300">Source or prompt has changed</span>
          <button
            onClick={props.onRegenerate}
            class="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
          >
            Regenerate
          </button>
        </div>
      </Show>

      {/* Empty state — just description, auto-generate handles the rest */}
      <Show when={!props.generating && !props.document}>
        <p class="text-sm text-muted-foreground leading-relaxed mt-3 max-w-lg">
          {TEMPLATE_DESCRIPTIONS[props.template.id] || "Use AI to generate content from the source."}
        </p>
      </Show>

      {/* Generating state — skeleton matching the template's layout */}
      <Show when={props.generating}>
        {getSkeletonForTemplate(props.template.id)}
      </Show>

      {/* Document content */}
      <Show when={!props.generating && props.document}>
        <div
          ref={contentRef}
          class="prose-custom space-y-4"
          innerHTML={htmlContent()}
        />
      </Show>
    </div>
  );
}
