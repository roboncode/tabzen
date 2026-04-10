import { createSignal, createEffect, For, Show } from "solid-js";
import { sendMessage } from "@/lib/messages";
import ProductPlaceholder from "./ProductPlaceholder";
import { ProductsSkeleton } from "./DocumentSkeletons";

interface ProductsViewProps {
  content: string;
}

interface Product {
  name: string;
  url: string | null;
  type: string;
  context: string;
  description: string;
}

interface ProductWithOG extends Product {
  ogImage: string | null;
  ogLoading: boolean;
  favicon: string | null;
}


function parseProducts(content: string): Product[] {
  const products: Product[] = [];
  let current: Partial<Product> | null = null;
  const seen = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^###\s+(.+)/);
    if (headerMatch) {
      if (current?.name) pushUnique(products, seen, finalize(current));
      current = { name: headerMatch[1].trim() };
      continue;
    }

    if (current) {
      const urlMatch = trimmed.match(/^-\s+URL:\s*(.+)/i);
      if (urlMatch) {
        const val = urlMatch[1].trim();
        current.url = isUnknownUrl(val) ? null : val;
        continue;
      }
      const typeMatch = trimmed.match(/^-\s+Type:\s*(.+)/i);
      if (typeMatch) { current.type = typeMatch[1].trim(); continue; }
      const contextMatch = trimmed.match(/^-\s+Context:\s*(.+)/i);
      if (contextMatch) { current.context = contextMatch[1].trim(); continue; }
      const descMatch = trimmed.match(/^-\s+Description:\s*(.+)/i);
      if (descMatch) { current.description = descMatch[1].trim(); continue; }
    }

    // Fallback: "- Name: Description" flat bullet format
    const bulletMatch = trimmed.match(/^-\s+\*?\*?(.+?)\*?\*?:\s*(.+)/);
    if (bulletMatch) {
      if (current?.name) pushUnique(products, seen, finalize(current));
      pushUnique(products, seen, finalize({
        name: bulletMatch[1].replace(/\*+/g, "").trim(),
        description: bulletMatch[2].trim(),
        context: "Mentioned",
        type: "Product",
        url: null,
      }));
      current = null;
      continue;
    }
  }

  if (current?.name) pushUnique(products, seen, finalize(current));
  return products;
}

function finalize(p: Partial<Product>): Product {
  return { name: p.name || "", url: p.url ?? null, type: p.type || "Product", context: p.context || "Mentioned", description: p.description || "" };
}

function pushUnique(arr: Product[], seen: Set<string>, p: Product) {
  const key = p.name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  arr.push(p);
}

function isUnknownUrl(val: string): boolean {
  const lower = val.toLowerCase();
  return lower === "unknown" || lower === "n/a" || lower === "none" || lower === "-";
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

function getFaviconUrl(url: string): string | null {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch { return null; }
}


export default function ProductsView(props: ProductsViewProps) {
  const [enriched, setEnriched] = createSignal<ProductWithOG[]>([]);
  const [allLoaded, setAllLoaded] = createSignal(false);

  createEffect(() => {
    const parsed = parseProducts(props.content);
    if (parsed.length === 0) {
      setEnriched([]);
      setAllLoaded(true);
      return;
    }

    setAllLoaded(false);
    let remaining = parsed.length;

    const initial: ProductWithOG[] = parsed.map((p) => ({
      ...p,
      ogImage: null,
      ogLoading: true,
      favicon: p.url ? getFaviconUrl(p.url) : null,
    }));

    // Collect all results, then reveal at once
    const results = [...initial];

    const checkDone = () => {
      remaining--;
      if (remaining <= 0) {
        setEnriched([...results]);
        setAllLoaded(true);
      }
    };

    for (let i = 0; i < parsed.length; i++) {
      const product = parsed[i];

      if (product.url) {
        sendMessage({ type: "GET_METADATA", url: product.url })
          .then((res) => {
            results[i] = { ...results[i], ogImage: res.type === "METADATA" ? res.ogImage : null, ogLoading: false };
          })
          .catch(() => {
            results[i] = { ...results[i], ogLoading: false };
          })
          .finally(checkDone);
      } else {
        sendMessage({ type: "LOOKUP_PRODUCT", name: product.name })
          .then((res) => {
            results[i] = {
              ...results[i],
              url: (res.type === "PRODUCT_LOOKUP" ? res.url : null) || results[i].url,
              ogImage: res.type === "PRODUCT_LOOKUP" ? res.image : null,
              favicon: (res.type === "PRODUCT_LOOKUP" && res.url) ? getFaviconUrl(res.url) : results[i].favicon,
              ogLoading: false,
            };
          })
          .catch(() => {
            results[i] = { ...results[i], ogLoading: false };
          })
          .finally(checkDone);
      }
    }
  });

  // Track OG images that failed to load in the browser (CORP, 404, etc.)
  const [failedImages, setFailedImages] = createSignal<Set<string>>(new Set());

  const markImageFailed = (src: string) => {
    setFailedImages((prev) => {
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  const linked = () => enriched().filter((p) => p.url);
  const unlinked = () => enriched().filter((p) => !p.url);

  return (
    <div class="px-2 pb-12">
      {/* Loading state — skeleton until all lookups complete */}
      <Show when={!allLoaded()}>
        <ProductsSkeleton />
      </Show>

      {/* Linked products — card grid */}
      <Show when={allLoaded() && linked().length > 0}>
        <div class="grid grid-cols-2 gap-x-4 gap-y-6">
          <For each={linked()}>
            {(product, i) => {
              const domain = product.url ? getDomain(product.url) : null;

              return (
                <a
                  href={product.url || "#"}
                  target="_blank"
                  class="no-underline cursor-pointer group"
                  onClick={(e) => { if (!product.url) e.preventDefault(); }}
                >
                  {/* Thumbnail */}
                  <div class="aspect-video rounded-xl overflow-hidden bg-muted/40 mb-3 relative">
                    <Show
                      when={product.ogImage && !failedImages().has(product.ogImage!)}
                      fallback={
                        <ProductPlaceholder name={product.name} favicon={product.favicon} index={i()} />
                      }
                    >
                      <img
                        src={product.ogImage!}
                        alt=""
                        loading="lazy"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={() => markImageFailed(product.ogImage!)}
                      />
                    </Show>
                    <div class="absolute top-2 right-2">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-sm bg-black/60 text-white/70">
                        {product.context}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div class="flex gap-3">
                    <Show when={product.favicon}>
                      <img src={product.favicon!} alt="" class="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <h3 class="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-sky-400">
                        {product.name}
                      </h3>
                      <Show when={product.description}>
                        <p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
                      </Show>
                      <Show when={domain}>
                        <div class="text-xs text-muted-foreground/60 mt-1">{domain}</div>
                      </Show>
                    </div>
                  </div>
                </a>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Unlinked mentions — compact cards */}
      <Show when={allLoaded() && unlinked().length > 0}>
        <div class={linked().length > 0 ? "mt-8" : ""}>
          <div class="text-xs font-semibold text-foreground/90 mb-3">Also mentioned</div>
          <div class="flex flex-col gap-2">
            <For each={unlinked()}>
              {(product) => (
                <div class="flex items-start gap-3 p-3 bg-muted/10 rounded-lg">
                  <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground/60">
                    {product.name.charAt(0)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-foreground/80">{product.name}</span>
                      <span class="text-[11px] text-muted-foreground/40">{product.type}</span>
                    </div>
                    <Show when={product.description}>
                      <p class="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">{product.description}</p>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
