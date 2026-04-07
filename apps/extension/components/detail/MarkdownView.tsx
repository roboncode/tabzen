import { createMemo, Show } from "solid-js";
import { FileText } from "lucide-solid";

interface MarkdownViewProps {
  content: string;
  onFetchContent?: () => void;
  loading?: boolean;
}

/**
 * Renders extracted markdown content as styled HTML.
 * Matches the reading experience of TranscriptView.
 */
export default function MarkdownView(props: MarkdownViewProps) {
  const htmlContent = createMemo(() => renderMarkdown(props.content));

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
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}

/**
 * Simple markdown to HTML renderer.
 * Handles the subset we get from Turndown: headings, paragraphs, bold, italic,
 * links, code blocks, inline code, lists, images, blockquotes, horizontal rules.
 */
function renderMarkdown(md: string): string {
  if (!md) return "";

  let html = md
    // Escape HTML entities first (prevent XSS from content)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="bg-muted/30 rounded-lg p-4 overflow-x-auto text-sm"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-foreground mt-6 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-foreground mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-foreground mt-10 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-semibold text-foreground mt-10 mb-4">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-muted/30 my-8" />');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-2 border-muted-foreground/20 pl-4 italic text-muted-foreground">$1</blockquote>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-4" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-400 hover:underline">$1</a>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted/30 px-1.5 py-0.5 rounded text-sm">$1</code>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="text-sm text-foreground/80 leading-[1.8] ml-4">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-foreground/80 leading-[1.8] ml-4 list-decimal">$1</li>');

  // Paragraphs — wrap remaining lines that aren't already wrapped in tags
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="text-sm text-foreground/80 leading-[1.8]">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="[^"]*"><\/p>/g, "");

  return html;
}
