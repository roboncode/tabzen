import { getDomain } from "./domains";

export type BuiltInTypeId =
  | "video"
  | "social"
  | "article"
  | "audio"
  | "shopping"
  | "other";

export interface MediaTypeDef {
  id: string;
  label: string;
  /** lucide-solid icon name (built-ins only). */
  icon?: string;
  /** accent color for custom types (badge / section header). */
  color?: string;
  builtIn: boolean;
}

export const BUILT_IN_TYPES: MediaTypeDef[] = [
  { id: "video", label: "Video", icon: "Video", builtIn: true },
  { id: "social", label: "Social", icon: "AtSign", builtIn: true },
  { id: "article", label: "Article", icon: "FileText", builtIn: true },
  { id: "audio", label: "Audio", icon: "Music", builtIn: true },
  { id: "shopping", label: "Shopping", icon: "ShoppingBag", builtIn: true },
  { id: "other", label: "Other", icon: "Globe", builtIn: true },
];

export const OTHER_TYPE: MediaTypeDef = BUILT_IN_TYPES[BUILT_IN_TYPES.length - 1];

/** Seed domain → built-in type map. Keys are bare domains (no "www."). */
export const DOMAIN_TYPE_MAP: Record<string, BuiltInTypeId> = {
  "youtube.com": "video",
  "youtu.be": "video",
  "tiktok.com": "video",
  "vimeo.com": "video",
  "twitch.tv": "video",
  "dailymotion.com": "video",
  "x.com": "social",
  "twitter.com": "social",
  "reddit.com": "social",
  "instagram.com": "social",
  "threads.net": "social",
  "bsky.app": "social",
  "facebook.com": "social",
  "linkedin.com": "social",
  "medium.com": "article",
  "substack.com": "article",
  "nytimes.com": "article",
  "dev.to": "article",
  "theverge.com": "article",
  "spotify.com": "audio",
  "open.spotify.com": "audio",
  "music.youtube.com": "audio",
  "soundcloud.com": "audio",
  "podcasts.apple.com": "audio",
  "amazon.com": "shopping",
  "ebay.com": "shopping",
  "etsy.com": "shopping",
};

/** Resolve a bare domain to a type id: override > seed map > "other". */
export function classifyDomain(
  domain: string,
  overrides: Record<string, string>,
): string {
  if (!domain) return "other";
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  if (overrides[normalized]) return overrides[normalized];
  return DOMAIN_TYPE_MAP[normalized] ?? "other";
}

/** Resolve a URL to a type id. Returns "other" for unparseable URLs. */
export function classifyMediaType(
  url: string,
  overrides: Record<string, string>,
): string {
  return classifyDomain(getDomain(url), overrides);
}

/** Built-ins (except "other") then custom types then "other" last. */
export function allMediaTypes(customTypes: MediaTypeDef[]): MediaTypeDef[] {
  const head = BUILT_IN_TYPES.filter((t) => t.id !== "other");
  return [...head, ...customTypes, OTHER_TYPE];
}

/** Resolve an id to its def, falling back to "other" for unknown ids. */
export function resolveMediaType(
  id: string,
  customTypes: MediaTypeDef[],
): MediaTypeDef {
  return allMediaTypes(customTypes).find((t) => t.id === id) ?? OTHER_TYPE;
}

/** Whether a URL should be captured given the saved type filter. */
export function includeUrlForCapture(
  url: string,
  captureTypes: string[],
  overrides: Record<string, string>,
): boolean {
  if (!captureTypes.length) return true;
  return captureTypes.includes(classifyMediaType(url, overrides));
}
