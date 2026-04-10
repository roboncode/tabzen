import { For, Show } from "solid-js";

interface SponsorsViewProps {
  content: string;
}

interface Sponsor {
  name: string;
  product: string;
  promo: string;
  timeframe: string;
  description: string;
}

function parseSponsors(content: string): Sponsor[] | null {
  const trimmed = content.trim();
  if (trimmed.startsWith("No sponsored content")) return null;

  const sponsors: Sponsor[] = [];
  let current: Partial<Sponsor> | null = null;

  for (const line of trimmed.split("\n")) {
    const t = line.trim();
    if (!t) continue;

    const headerMatch = t.match(/^###\s+(.+)/);
    if (headerMatch) {
      if (current?.name) sponsors.push(finalize(current));
      current = { name: headerMatch[1].trim() };
      continue;
    }

    if (current) {
      const productMatch = t.match(/^-\s+Product:\s*(.+)/i);
      if (productMatch) { current.product = productMatch[1].trim(); continue; }
      const promoMatch = t.match(/^-\s+Promo:\s*(.+)/i);
      if (promoMatch) { current.promo = promoMatch[1].trim(); continue; }
      const timeMatch = t.match(/^-\s+Timeframe:\s*(.+)/i);
      if (timeMatch) { current.timeframe = timeMatch[1].trim(); continue; }
      const descMatch = t.match(/^-\s+Description:\s*(.+)/i);
      if (descMatch) { current.description = descMatch[1].trim(); continue; }
    }
  }

  if (current?.name) sponsors.push(finalize(current));
  return sponsors.length > 0 ? sponsors : null;
}

function finalize(p: Partial<Sponsor>): Sponsor {
  return {
    name: p.name || "",
    product: p.product || "",
    promo: p.promo || "None mentioned",
    timeframe: p.timeframe || "",
    description: p.description || "",
  };
}

export default function SponsorsView(props: SponsorsViewProps) {
  const sponsors = () => parseSponsors(props.content);

  return (
    <div class="px-2 pb-12">
      <Show
        when={sponsors()}
        fallback={
          <div class="py-8">
            <p class="text-sm text-muted-foreground/60">No sponsored content detected in this content.</p>
          </div>
        }
      >
        {(list) => (
          <div class="flex flex-col gap-4">
            <For each={list()}>
              {(sponsor) => (
                <div class="p-4 bg-muted/10 rounded-xl">
                  <div class="flex items-start justify-between gap-3 mb-2">
                    <h3 class="text-sm font-semibold text-foreground">{sponsor.name}</h3>
                    <Show when={sponsor.timeframe}>
                      <span class="flex-shrink-0 text-xs text-muted-foreground/50 bg-muted/20 px-2 py-0.5 rounded-md">
                        {sponsor.timeframe}
                      </span>
                    </Show>
                  </div>
                  <p class="text-sm text-foreground/70 leading-relaxed mb-3">{sponsor.description}</p>
                  <div class="flex flex-col gap-1.5">
                    <Show when={sponsor.product}>
                      <div class="flex items-baseline gap-2">
                        <span class="text-xs text-muted-foreground/50">Product</span>
                        <span class="text-sm text-foreground/60">{sponsor.product}</span>
                      </div>
                    </Show>
                    <Show when={sponsor.promo && sponsor.promo !== "None mentioned"}>
                      <div class="flex items-baseline gap-2">
                        <span class="text-xs text-muted-foreground/50">Promo</span>
                        <span class="text-sm text-sky-400 font-medium">{sponsor.promo}</span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}
