import { For } from "solid-js";

interface KeyPoint {
  title: string;
  description: string;
}

interface KeyPointsViewProps {
  content: string;
}

function parseKeyPoints(content: string): KeyPoint[] {
  return content
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const pipeIndex = line.indexOf("|");
      if (pipeIndex !== -1) {
        return {
          title: line.slice(0, pipeIndex).trim(),
          description: line.slice(pipeIndex + 1).trim(),
        };
      }
      return { title: "", description: line };
    });
}

export default function KeyPointsView(props: KeyPointsViewProps) {
  const points = () => parseKeyPoints(props.content);

  return (
    <div class="px-2 pb-12">
      <div class="flex flex-col gap-2">
        <For each={points()}>
          {(point, i) => (
            <div class="flex gap-3.5 p-3.5 bg-muted/20 rounded-xl">
              <span class="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-sky-400/10 text-sky-300 text-sm font-semibold rounded-lg">
                {i() + 1}
              </span>
              <div class="flex flex-col gap-1 min-w-0">
                {point.title && (
                  <p class="text-sm font-semibold text-foreground leading-snug m-0">
                    {point.title}
                  </p>
                )}
                <p class="text-sm text-foreground/60 leading-[1.7] m-0">
                  {point.description}
                </p>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
