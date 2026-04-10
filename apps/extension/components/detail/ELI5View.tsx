import { createSignal, createEffect, For, Show } from "solid-js";
import { marked } from "marked";
import { sendMessage } from "@/lib/messages";

interface ELI5ViewProps {
  content: string;
}

interface ELI5Parsed {
  analogyTitle: string;
  analogyBody: string;
  howItWorks: string;
  whyItMatters: string;
  concepts: { term: string; definition: string }[];
  imageTerms: { key: string; title: string }[];
}

function parseELI5(content: string): ELI5Parsed | null {
  const sections: Record<string, string> = {};
  let currentKey = "";

  for (const line of content.split("\n")) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      currentKey = headerMatch[1].trim();
      sections[currentKey] = "";
    } else if (currentKey) {
      sections[currentKey] += line + "\n";
    }
  }

  // Find analogy section (key starts with "Analogy:")
  const analogyKey = Object.keys(sections).find((k) => k.toLowerCase().startsWith("analogy"));

  // If structured format wasn't used, synthesize from plain paragraphs
  if (!analogyKey) {
    const paragraphs = content
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) return null;

    return {
      analogyTitle: "In Simple Terms",
      analogyBody: paragraphs[0],
      howItWorks: paragraphs[1] || "",
      whyItMatters: paragraphs[2] || "",
      concepts: [],
      imageTerms: [],
    };
  }

  const analogyTitle = analogyKey.replace(/^analogy:\s*/i, "").replace(/^\[+/, "").replace(/\]+$/, "").trim();
  const analogyBody = (sections[analogyKey] || "").trim();

  const howKey = Object.keys(sections).find((k) => k.toLowerCase().includes("how"));
  const whyKey = Object.keys(sections).find((k) => k.toLowerCase().includes("why"));
  const conceptKey = Object.keys(sections).find((k) => k.toLowerCase().includes("concept"));

  // Parse concepts from "- **Term**: definition" format
  const concepts: { term: string; definition: string }[] = [];
  if (conceptKey && sections[conceptKey]) {
    for (const line of sections[conceptKey].split("\n")) {
      const match = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        concepts.push({ term: match[1], definition: match[2] });
      }
    }
  }

  // Parse image terms from "- key: WikiTitle" format
  const imageTerms: { key: string; title: string }[] = [];
  const imageKey = Object.keys(sections).find((k) => k.toLowerCase().includes("image"));
  if (imageKey && sections[imageKey]) {
    for (const line of sections[imageKey].split("\n")) {
      const match = line.match(/^-\s+(\w+):\s*(.+)/);
      if (match) {
        // Strip brackets the AI sometimes adds: [Traffic_jam] → Traffic_jam
        const title = match[2].trim().replace(/^\[+/, "").replace(/\]+$/, "");
        imageTerms.push({ key: match[1].trim(), title });
      }
    }
  }

  return {
    analogyTitle,
    analogyBody,
    howItWorks: (howKey ? sections[howKey] : "").trim(),
    whyItMatters: (whyKey ? sections[whyKey] : "").trim(),
    concepts,
    imageTerms,
  };
}

const CONCEPT_COLORS = [
  { bg: "bg-sky-400/10", text: "text-sky-300" },
  { bg: "bg-emerald-400/10", text: "text-emerald-300" },
  { bg: "bg-amber-400/10", text: "text-amber-300" },
  { bg: "bg-purple-400/10", text: "text-purple-300" },
  { bg: "bg-rose-400/10", text: "text-rose-300" },
];

export default function ELI5View(props: ELI5ViewProps) {
  const parsed = () => parseELI5(props.content);
  const [images, setImages] = createSignal<Record<string, string>>({});

  // Fetch Wikipedia images for the image terms
  createEffect(() => {
    const data = parsed();
    if (!data?.imageTerms.length) return;

    for (const term of data.imageTerms) {
      sendMessage({ type: "LOOKUP_WIKI_IMAGE", title: term.title })
        .then((res) => {
          if (res.type === "WIKI_IMAGE" && res.url) {
            setImages((prev) => ({ ...prev, [term.key]: res.url! }));
          }
        })
        .catch(() => {});
    }
  });

  // Fallback: if parsing fails, render as plain markdown
  const fallbackHtml = () => {
    if (parsed()) return "";
    return marked.parse(props.content, { async: false }) as string;
  };

  return (
    <div class="px-2 pb-12">
      <Show
        when={parsed()}
        fallback={
          <div class="prose-custom space-y-4" innerHTML={fallbackHtml()} />
        }
      >
        {(data) => (
          <div class="flex flex-col gap-5">
            {/* Key concepts */}
            <Show when={data().concepts.length > 0}>
              <div>
                <div class="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/50 mb-2.5 pl-1">
                  Key concepts
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <For each={data().concepts}>
                    {(concept, i) => {
                      const color = CONCEPT_COLORS[i() % CONCEPT_COLORS.length];
                      return (
                        <span
                          class={`px-3 py-1.5 rounded-lg text-sm ${color.bg} ${color.text}`}
                          title={concept.definition}
                        >
                          {concept.term}
                        </span>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>

            {/* Analogy hero — image left, text right; stacks on narrow */}
            <div class="rounded-xl bg-muted/20 overflow-hidden">
              <div class={`flex flex-col ${images().analogy ? "sm:flex-row" : ""}`}>
                <Show when={images().analogy}>
                  <img
                    src={images().analogy}
                    alt=""
                    class="w-full sm:w-2/5 h-48 sm:h-auto object-cover flex-shrink-0"
                    loading="lazy"
                  />
                </Show>
                <div class="p-5 flex-1">
                  <div class="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/50 mb-1">
                    Think of it like
                  </div>
                  <div class="text-base font-semibold text-foreground/90 mb-3">
                    {data().analogyTitle}
                  </div>
                  <p class="text-sm text-foreground/70 leading-[1.8] m-0">
                    {data().analogyBody}
                  </p>
                </div>
              </div>
            </div>

            {/* How it works + topic image — side by side on wide, stacked on narrow */}
            <div class={`flex flex-col gap-4 ${images().topic ? "sm:flex-row" : ""}`}>
              <Show when={data().howItWorks}>
                <div class="flex-1">
                  <div class="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/50 mb-2 pl-1">
                    How it works
                  </div>
                  <p class="text-sm text-foreground/80 leading-[1.8] m-0">
                    {data().howItWorks}
                  </p>
                </div>
              </Show>
              <Show when={images().topic}>
                <div class="w-full sm:w-2/5 flex-shrink-0 rounded-xl overflow-hidden">
                  <img
                    src={images().topic}
                    alt=""
                    class="w-full h-48 sm:h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </Show>
            </div>

            {/* Why it matters — compact callout */}
            <Show when={data().whyItMatters}>
              <div class="flex gap-3 items-start p-4 rounded-xl bg-muted/15">
                <div class="flex-shrink-0 w-1 rounded-full bg-sky-400/30 self-stretch" />
                <div>
                  <div class="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/50 mb-1.5">
                    Why it matters
                  </div>
                  <p class="text-sm text-foreground/80 leading-[1.8] m-0">
                    {data().whyItMatters}
                  </p>
                </div>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
