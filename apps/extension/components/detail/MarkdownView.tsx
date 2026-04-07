import { createMemo, createEffect, Show } from "solid-js";
import { FileText } from "lucide-solid";
import { marked } from "marked";

interface MarkdownViewProps {
  content: string;
  onFetchContent?: () => void;
  loading?: boolean;
}

// Configure marked for our use case
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer to apply our Tailwind classes
const renderer = new marked.Renderer();

renderer.heading = ({ text, depth }) => {
  const styles: Record<number, string> = {
    1: "text-xl font-semibold text-foreground mt-10 mb-4",
    2: "text-lg font-semibold text-foreground mt-10 mb-3",
    3: "text-base font-semibold text-foreground mt-8 mb-3",
    4: "text-sm font-semibold text-foreground mt-6 mb-2",
  };
  const tag = `h${depth}`;
  return `<${tag} class="${styles[depth] || styles[4]}">${text}</${tag}>`;
};

renderer.paragraph = ({ text }) =>
  `<p class="text-sm text-foreground/80 leading-[1.8]">${text}</p>`;

renderer.link = ({ href, text }) =>
  `<a href="${href}" target="_blank" class="text-sky-400 hover:underline">${text}</a>`;

renderer.image = ({ href, text }) =>
  `<img src="${href}" alt="${text}" class="rounded-lg max-w-full my-4" />`;

renderer.code = ({ text, lang }) => {
  const langAttr = lang ? ` data-lang="${lang}"` : "";
  return `<pre class="bg-muted/30 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed my-4"${langAttr}><code>${text}</code></pre>`;
};

renderer.codespan = ({ text }) =>
  `<code class="bg-muted/30 px-1.5 py-0.5 rounded text-sm">${text}</code>`;

renderer.blockquote = ({ text }) =>
  `<blockquote class="border-l-2 border-muted-foreground/20 pl-4 italic text-muted-foreground">${text}</blockquote>`;

renderer.list = (token) => {
  const tag = token.ordered ? "ol" : "ul";
  let body = "";
  for (const item of token.items) {
    body += renderer.listitem(item);
  }
  return `<${tag} class="ml-4 space-y-1 ${token.ordered ? "list-decimal" : "list-disc"}">${body}</${tag}>`;
};

renderer.listitem = ({ text }) =>
  `<li class="text-sm text-foreground/80 leading-[1.8]">${text}</li>`;

renderer.hr = () => `<hr class="border-muted/30 my-8" />`;

marked.use({ renderer });

// --- Shiki syntax highlighting (bundled, lazy-loaded) ---

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  javascript: "javascript",
  typescript: "typescript",
  json: "json",
  css: "css",
  html: "html",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  yaml: "yaml",
  yml: "yaml",
  python: "python",
  py: "python",
  sql: "sql",
  xml: "xml",
};

let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    try {
      const { createHighlighterCore } = await import("shiki/core");
      const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
      const highlighter = await createHighlighterCore({
        themes: [import("shiki/themes/github-dark-dimmed.mjs")],
        langs: [
          import("shiki/langs/javascript.mjs"),
          import("shiki/langs/typescript.mjs"),
          import("shiki/langs/json.mjs"),
          import("shiki/langs/css.mjs"),
          import("shiki/langs/html.mjs"),
          import("shiki/langs/bash.mjs"),
          import("shiki/langs/yaml.mjs"),
          import("shiki/langs/python.mjs"),
          import("shiki/langs/xml.mjs"),
          import("shiki/langs/sql.mjs"),
        ],
        engine: createJavaScriptRegexEngine(),
      });
      return highlighter;
    } catch (e) {
      console.warn("[TabZen] Failed to load Shiki:", e);
      highlighterPromise = null;
      return null;
    }
  })();

  return highlighterPromise;
}

async function highlightCodeBlocks(container: HTMLElement) {
  const preWithLang = container.querySelectorAll("pre[data-lang]");
  if (preWithLang.length === 0) return;

  const highlighter = await getHighlighter();
  if (!highlighter) return;

  for (const pre of preWithLang) {
    const rawLang = pre.getAttribute("data-lang") || "";
    const lang = LANG_MAP[rawLang.toLowerCase()];
    if (!lang) continue;

    const code = pre.querySelector("code");
    if (!code) continue;

    try {
      const highlighted = highlighter.codeToHtml(code.textContent || "", {
        lang,
        theme: "github-dark-dimmed",
      });
      const tmp = document.createElement("div");
      tmp.innerHTML = highlighted;
      const shikiPre = tmp.querySelector("pre");
      if (shikiPre) {
        // Keep our rounded/padding classes, replace inner content with Shiki output
        pre.innerHTML = shikiPre.innerHTML;
        // Carry over Shiki's inline background style
        const bg = (shikiPre as HTMLElement).style.backgroundColor;
        if (bg) (pre as HTMLElement).style.backgroundColor = bg;
        pre.removeAttribute("data-lang");
      }
    } catch {
      // Language not supported or error — leave as plain text
    }
  }
}

/**
 * Renders extracted markdown content as styled HTML.
 * Code blocks get syntax highlighting via Shiki (bundled, lazy-loaded).
 */
export default function MarkdownView(props: MarkdownViewProps) {
  const htmlContent = createMemo(() => {
    if (!props.content) return "";
    return marked.parse(props.content, { async: false }) as string;
  });

  let contentRef: HTMLDivElement | undefined;

  // After content renders, apply syntax highlighting
  createEffect(() => {
    const html = htmlContent();
    if (!html || !contentRef) return;

    requestAnimationFrame(() => {
      if (contentRef) highlightCodeBlocks(contentRef);
    });
  });

  return (
    <div>
      <Show
        when={props.content}
        fallback={
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No content available</p>
            <Show when={props.onFetchContent}>
              <button
                onClick={props.onFetchContent}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Extracting..." : "Extract Content"}
              </button>
            </Show>
          </div>
        }
      >
        <div class="max-w-3xl mx-auto px-2 pb-12">
          <div
            ref={contentRef}
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}
