import { createSignal, createMemo, For, Show } from "solid-js";
import { FileText } from "lucide-solid";
import type { TranscriptSegment } from "@tab-zen/shared";

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  chapters?: { title: string; startMs: number }[];
  onFetchTranscript?: () => void;
  loading?: boolean;
}

interface Paragraph {
  startMs: number;
  text: string;
  segments: TranscriptSegment[];
  startsWithSentence: boolean;
}

interface ChapterSection {
  title: string;
  startMs: number;
  index: number;
  paragraphs: Paragraph[];
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getTimestampUrl(videoUrl: string, ms: number): string {
  const seconds = Math.floor(ms / 1000);
  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}

function mergeIntoParagraphs(segments: TranscriptSegment[], gapMs: number = 4000): Paragraph[] {
  if (segments.length === 0) return [];

  const paragraphs: Paragraph[] = [];
  let currentSegments: TranscriptSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const gap = curr.startMs - (prev.startMs + prev.durationMs);
    const wordCount = currentSegments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);

    if (gap > gapMs || wordCount > 80) {
      const text = currentSegments.map((s) => s.text).join(" ");
      paragraphs.push({
        startMs: currentSegments[0].startMs,
        text,
        segments: currentSegments,
        startsWithSentence: startsWithCapital(text),
      });
      currentSegments = [curr];
    } else {
      currentSegments.push(curr);
    }
  }

  if (currentSegments.length > 0) {
    const text = currentSegments.map((s) => s.text).join(" ");
    paragraphs.push({
      startMs: currentSegments[0].startMs,
      text,
      segments: currentSegments,
      startsWithSentence: startsWithCapital(text),
    });
  }

  return paragraphs;
}

function buildChapterSections(
  segments: TranscriptSegment[],
  chapters: { title: string; startMs: number }[],
): ChapterSection[] {
  if (segments.length === 0 || chapters.length === 0) return [];

  const sorted = [...chapters].sort((a, b) => a.startMs - b.startMs);
  const sections: ChapterSection[] = [];

  for (let ci = 0; ci < sorted.length; ci++) {
    const chapterStart = sorted[ci].startMs;
    const chapterEnd = ci < sorted.length - 1 ? sorted[ci + 1].startMs : Infinity;

    const chapterSegments = segments.filter(
      (s) => s.startMs >= chapterStart && s.startMs < chapterEnd,
    );

    sections.push({
      title: sorted[ci].title,
      startMs: chapterStart,
      index: ci,
      paragraphs: mergeIntoParagraphs(chapterSegments),
    });
  }

  return sections;
}

function startsWithCapital(text: string): boolean {
  const first = text.trim()[0];
  return first ? first === first.toUpperCase() && first !== first.toLowerCase() : false;
}

const SegmentSpan = (p: { segment: TranscriptSegment; videoUrl: string; onHover: (seg: TranscriptSegment | null, rect: DOMRect | null) => void }) => (
  <a
    href={getTimestampUrl(p.videoUrl, p.segment.startMs)}
    target="_blank"
    class="hover:text-sky-400 hover:underline decoration-sky-400/30 underline-offset-2 transition-colors cursor-pointer rounded-sm"
    onClick={(e) => e.stopPropagation()}
    onMouseEnter={(e) => p.onHover(p.segment, (e.target as HTMLElement).getBoundingClientRect())}
    onMouseLeave={() => p.onHover(null, null)}
  >
    {p.segment.text}
  </a>
);

const ParagraphText = (p: { segments: TranscriptSegment[]; videoUrl: string; dropCap: boolean; onSegmentHover: (seg: TranscriptSegment | null, rect: DOMRect | null) => void }) => {
  if (p.segments.length === 0) return null;

  const firstSeg = p.segments[0];
  const restSegs = p.segments.slice(1);

  if (!p.dropCap) {
    return (
      <p class="text-sm text-foreground/80 leading-[1.8]">
        <For each={p.segments}>
          {(seg, i) => (
            <>
              {i() > 0 && " "}
              <SegmentSpan segment={seg} videoUrl={p.videoUrl} onHover={p.onSegmentHover} />
            </>
          )}
        </For>
      </p>
    );
  }

  const firstLetter = firstSeg.text[0];
  const firstSegRest = firstSeg.text.slice(1);

  return (
    <p class="text-sm text-foreground/80 leading-[1.8]">
      <span class="float-left text-[2.5rem] leading-[1] font-semibold text-foreground mr-2 mt-0.5">
        {firstLetter}
      </span>
      <a
        href={getTimestampUrl(p.videoUrl, firstSeg.startMs)}
        target="_blank"
        class="hover:text-sky-400 hover:underline decoration-sky-400/30 underline-offset-2 transition-colors cursor-pointer rounded-sm"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => p.onSegmentHover(firstSeg, (e.target as HTMLElement).getBoundingClientRect())}
        onMouseLeave={() => p.onSegmentHover(null, null)}
      >
        {firstSegRest}
      </a>
      <For each={restSegs}>
        {(seg) => (
          <>
            {" "}
            <SegmentSpan segment={seg} videoUrl={p.videoUrl} onHover={p.onSegmentHover} />
          </>
        )}
      </For>
    </p>
  );
};

export default function TranscriptView(props: TranscriptViewProps) {
  const [hoveredSeg, setHoveredSeg] = createSignal<{ seg: TranscriptSegment; top: number } | null>(null);
  const paragraphs = createMemo(() => mergeIntoParagraphs(props.segments));
  const chapterSections = createMemo(() =>
    props.chapters?.length ? buildChapterSections(props.segments, props.chapters) : null,
  );

  let contentRef: HTMLDivElement | undefined;

  const handleSegmentHover = (seg: TranscriptSegment | null, rect: DOMRect | null) => {
    if (!seg || !rect || !contentRef) {
      setHoveredSeg(null);
      return;
    }
    const containerRect = contentRef.getBoundingClientRect();
    setHoveredSeg({ seg, top: rect.top - containerRect.top + rect.height / 2 });
  };

  return (
    <div>
      <Show
        when={props.segments.length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No transcript available</p>
            <Show when={props.onFetchTranscript}>
              <button
                onClick={props.onFetchTranscript}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Fetching..." : "Fetch Transcript"}
              </button>
            </Show>
          </div>
        }
      >
        <div ref={contentRef} class="px-2 pb-12 relative">
          {/* Floating timestamp indicator */}
          <Show when={hoveredSeg()}>
            {(hovered) => (
              <div
                class="absolute right-0 pointer-events-none z-10"
                style={{ top: `${hovered().top}px`, transform: "translateY(-50%)" }}
              >
                <div class="flex items-center gap-1.5">
                  <div class="h-px w-4 bg-sky-400/40" />
                  <span class="text-xs font-medium text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {formatTimestamp(hovered().seg.startMs)}
                  </span>
                </div>
              </div>
            )}
          </Show>

          <div class="space-y-10 pr-16">
            <Show
              when={chapterSections()}
              fallback={
                <For each={paragraphs()}>
                  {(para) => (
                    <div class="group/para">
                      <a
                        href={getTimestampUrl(props.videoUrl, para.startMs)}
                        target="_blank"
                        class="flex items-center gap-3 mb-3 text-muted-foreground/25 hover:text-sky-500 group-hover/para:text-muted-foreground/40 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span class="text-xl font-extralight tracking-tight">
                          {formatTimestamp(para.startMs)}
                        </span>
                        <div class="h-px flex-1 bg-current" />
                      </a>
                      <ParagraphText segments={para.segments} videoUrl={props.videoUrl} dropCap={para.startsWithSentence} onSegmentHover={handleSegmentHover} />
                    </div>
                  )}
                </For>
              }
            >
              {(sections) => (
                <For each={sections()}>
                  {(section) => (
                    <div>
                      <div class="flex items-baseline gap-3 mt-2 mb-4">
                        <h2
                          id={`chapter-${section.index}`}
                          class="text-lg font-semibold text-foreground"
                        >
                          {section.title}
                        </h2>
                        <a
                          href={getTimestampUrl(props.videoUrl, section.startMs)}
                          target="_blank"
                          class="text-xs text-muted-foreground/40 hover:text-sky-400 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatTimestamp(section.startMs)}
                        </a>
                      </div>
                      <div class="space-y-10">
                        <For each={section.paragraphs}>
                          {(para, pi) => (
                            <div class="group/para">
                              <Show when={pi() > 0}>
                                <a
                                  href={getTimestampUrl(props.videoUrl, para.startMs)}
                                  target="_blank"
                                  class="flex items-center gap-3 mb-3 text-muted-foreground/25 hover:text-sky-500 group-hover/para:text-muted-foreground/40 transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span class="text-xl font-extralight tracking-tight">
                                    {formatTimestamp(para.startMs)}
                                  </span>
                                  <div class="h-px flex-1 bg-current" />
                                </a>
                              </Show>
                              <ParagraphText segments={para.segments} videoUrl={props.videoUrl} dropCap={pi() === 0 && para.startsWithSentence} onSegmentHover={handleSegmentHover} />
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              )}
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
