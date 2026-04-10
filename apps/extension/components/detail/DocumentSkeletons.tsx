import { For } from "solid-js";

const s = "animate-pulse bg-muted/30 rounded";

/** Key Points — numbered cards */
export function KeyPointsSkeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="flex flex-col gap-2">
        <For each={[1, 2, 3, 4, 5, 6]}>
          {(n) => (
            <div class="flex gap-3.5 p-3.5 bg-muted/10 rounded-xl">
              <div class={`flex-shrink-0 w-7 h-7 rounded-lg ${s}`} />
              <div class="flex flex-col gap-1.5 flex-1">
                <div class={`h-4 ${s}`} style={{ width: `${40 + (n * 7) % 30}%` }} />
                <div class={`h-3.5 ${s}`} style={{ width: `${70 + (n * 11) % 25}%` }} />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

/** Action Items — two groups with checkboxes */
export function ActionItemsSkeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="flex items-center gap-3 mb-5">
        <div class={`w-9 h-9 rounded-full ${s}`} />
        <div class={`h-3.5 w-24 ${s}`} />
      </div>

      <For each={[3, 2]}>
        {(count, gi) => (
          <div class={gi() === 0 ? "mb-4" : ""}>
            <div class="flex items-center gap-1.5 mb-2 pl-1">
              <div class={`w-1.5 h-1.5 rounded-full ${s}`} />
              <div class={`h-3 w-16 ${s}`} />
            </div>
            <div class="flex flex-col gap-1.5">
              <For each={Array.from({ length: count })}>
                {(_, n) => (
                  <div class="flex items-start gap-3 p-3 rounded-xl bg-muted/5">
                    <div class={`flex-shrink-0 w-5 h-5 rounded-md ${s}`} />
                    <div class="flex-1 flex flex-col gap-1.5">
                      <div class={`h-4 ${s}`} style={{ width: `${35 + (n() * 13) % 25}%` }} />
                      <div class={`h-3.5 ${s}`} style={{ width: `${60 + (n() * 9) % 30}%` }} />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

/** ELI5 — concept tags, analogy card, text sections */
export function ELI5Skeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="flex flex-col gap-5">
        <div>
          <div class={`h-3 w-24 mb-2.5 ml-1 ${s}`} />
          <div class="flex flex-wrap gap-1.5">
            <For each={[70, 55, 80, 60]}>
              {(w) => <div class={`h-8 rounded-lg ${s}`} style={{ width: `${w}px` }} />}
            </For>
          </div>
        </div>

        <div class="rounded-xl bg-muted/10 p-5">
          <div class={`h-3 w-20 mb-2 ${s}`} />
          <div class={`h-5 w-3/5 mb-3 ${s}`} />
          <div class="flex flex-col gap-2">
            <div class={`h-3.5 w-full ${s}`} />
            <div class={`h-3.5 w-11/12 ${s}`} />
            <div class={`h-3.5 w-4/5 ${s}`} />
          </div>
        </div>

        <div>
          <div class={`h-3 w-24 mb-2 ml-1 ${s}`} />
          <div class="flex flex-col gap-2">
            <div class={`h-3.5 w-full ${s}`} />
            <div class={`h-3.5 w-11/12 ${s}`} />
            <div class={`h-3.5 w-3/4 ${s}`} />
          </div>
        </div>

        <div class="flex gap-3 items-start p-4 rounded-xl bg-muted/10">
          <div class={`flex-shrink-0 w-1 rounded-full self-stretch min-h-[60px] ${s}`} />
          <div class="flex-1 flex flex-col gap-2">
            <div class={`h-3 w-24 ${s}`} />
            <div class={`h-3.5 w-full ${s}`} />
            <div class={`h-3.5 w-5/6 ${s}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Products — 2-column grid of cards + also mentioned list */
export function ProductsSkeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="grid grid-cols-2 gap-x-4 gap-y-6">
        <For each={[1, 2, 3, 4]}>
          {() => (
            <div>
              <div class={`aspect-video rounded-xl mb-3 ${s}`} />
              <div class="flex gap-3">
                <div class={`w-5 h-5 rounded-full flex-shrink-0 ${s}`} />
                <div class="flex-1 flex flex-col gap-1.5">
                  <div class={`h-4 w-3/4 ${s}`} />
                  <div class={`h-3 w-full ${s}`} />
                  <div class={`h-3 w-1/3 ${s}`} />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Also mentioned */}
      <div class="mt-8">
        <div class={`h-3.5 w-28 mb-3 ${s}`} />
        <div class="flex flex-col gap-2">
          <For each={[1, 2, 3]}>
            {(n) => (
              <div class="flex items-start gap-3 p-3 bg-muted/10 rounded-lg">
                <div class={`flex-shrink-0 w-8 h-8 rounded-lg ${s}`} />
                <div class="flex-1 flex flex-col gap-1.5">
                  <div class={`h-4 ${s}`} style={{ width: `${30 + (n * 11) % 25}%` }} />
                  <div class={`h-3 ${s}`} style={{ width: `${60 + (n * 7) % 30}%` }} />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

/** Summary / generic — prose paragraphs */
export function ProseSkeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class={`h-4 w-full ${s}`} />
          <div class={`h-4 w-full ${s}`} />
          <div class={`h-4 w-11/12 ${s}`} />
          <div class={`h-4 w-3/4 ${s}`} />
        </div>

        <div class="border-l-2 border-muted/20 pl-4 py-1">
          <div class={`h-4 w-5/6 ${s}`} />
          <div class={`h-4 w-2/3 mt-2 ${s}`} />
        </div>

        <div class="flex flex-col gap-2">
          <div class={`h-4 w-full ${s}`} />
          <div class={`h-4 w-full ${s}`} />
          <div class={`h-4 w-10/12 ${s}`} />
        </div>
      </div>
    </div>
  );
}

/** Sponsors — cards with metadata */
export function SponsorsSkeleton() {
  return (
    <div class="px-2 pb-12">
      <div class="flex flex-col gap-4">
        <For each={[1, 2]}>
          {(n) => (
            <div class="p-4 bg-muted/10 rounded-xl">
              <div class="flex items-start justify-between mb-2">
                <div class={`h-4 rounded ${s}`} style={{ width: `${30 + (n * 13) % 20}%` }} />
                <div class={`h-5 w-16 rounded-md ${s}`} />
              </div>
              <div class={`h-3.5 w-full rounded mb-3 ${s}`} />
              <div class="flex flex-col gap-1.5">
                <div class="flex gap-2">
                  <div class={`h-3 w-12 rounded ${s}`} />
                  <div class={`h-3 rounded ${s}`} style={{ width: `${40 + (n * 7) % 25}%` }} />
                </div>
                <div class="flex gap-2">
                  <div class={`h-3 w-10 rounded ${s}`} />
                  <div class={`h-3 w-24 rounded ${s}`} />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export const SKELETON_MAP: Record<string, () => any> = {
  "builtin-key-points": () => <KeyPointsSkeleton />,
  "builtin-action-items": () => <ActionItemsSkeleton />,
  "builtin-eli5": () => <ELI5Skeleton />,
  "builtin-products-mentions": () => <ProductsSkeleton />,
  "builtin-sponsors": () => <SponsorsSkeleton />,
};

export function getSkeletonForTemplate(templateId: string) {
  const factory = SKELETON_MAP[templateId];
  return factory ? factory() : <ProseSkeleton />;
}
