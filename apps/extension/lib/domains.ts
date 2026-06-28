import type { Page, Group } from "./types";
import { classifyDomain, allMediaTypes, type MediaTypeDef } from "./media-types";

const SOCIAL_PLATFORMS = new Set([
  "youtube.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "twitch.tv",
  "reddit.com",
  "facebook.com",
  "linkedin.com",
  "threads.net",
  "bsky.app",
]);

export function getFaviconUrl(page: { favicon: string; url: string }): string {
  if (page.favicon && !page.favicon.startsWith("chrome://")) return page.favicon;
  const domain = getDomain(page.url);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function isSocialPlatform(domain: string): boolean {
  return SOCIAL_PLATFORMS.has(domain);
}

export function extractCreator(page: Page): string | null {
  // Use stored creator if available (extracted at capture time from DOM)
  if (page.creator) return page.creator;

  const domain = getDomain(page.url);

  try {
    const u = new URL(page.url);

    if (domain === "youtube.com") {
      // YouTube: try /@handle or /channel/ or /c/ patterns from URL
      const match = u.pathname.match(/^\/@([^/]+)/);
      if (match) return `@${match[1]}`;

      const channelMatch = u.pathname.match(/^\/(?:channel|c|user)\/([^/]+)/);
      if (channelMatch) return channelMatch[1];

      // For /watch?v= URLs: title is "Video Title - YouTube"
      // The channel isn't in the standard title, but sometimes the
      // OG description has channel context. Try to extract from title
      // by removing the " - YouTube" suffix and any "(123) " prefix
      if (page.title) {
        let title = page.title;
        // Remove " - YouTube" suffix
        title = title.replace(/\s*-\s*YouTube\s*$/, "");
        // Remove notification count prefix like "(123) "
        title = title.replace(/^\(\d+\)\s*/, "");

        // If the remaining title has " - ", the last segment might be channel
        // e.g. "React Tutorial - Fireship" → "Fireship"
        // But "How to Build X - A Complete Guide" is NOT a channel
        // Only treat it as channel if it's short (< 30 chars) and has no common title words
        const parts = title.split(" - ");
        if (parts.length >= 2) {
          const candidate = parts[parts.length - 1].trim();
          if (candidate.length < 30 && candidate.length > 0) {
            return candidate;
          }
        }
      }

      // Try OG description - some YouTube descriptions start with channel context
      if (page.ogDescription) {
        // YouTube OG descriptions often have channel info embedded
        // but format varies too much to reliably extract
      }

      return null; // Will be grouped under the domain without a creator
    }

    if (domain === "instagram.com" || domain === "threads.net") {
      const match = u.pathname.match(/^\/([^/]+)/);
      if (match && !["p", "reel", "stories", "explore", "direct"].includes(match[1])) {
        return `@${match[1]}`;
      }
    }

    if (domain === "tiktok.com") {
      const match = u.pathname.match(/^\/@([^/]+)/);
      if (match) return `@${match[1]}`;
    }

    if (domain === "twitter.com" || domain === "x.com") {
      const match = u.pathname.match(/^\/([^/]+)/);
      if (match && !["home", "explore", "search", "notifications", "messages", "settings", "i"].includes(match[1])) {
        return `@${match[1]}`;
      }
    }

    if (domain === "twitch.tv") {
      const match = u.pathname.match(/^\/([^/]+)/);
      if (match && !["directory", "downloads", "jobs", "turbo"].includes(match[1])) {
        return match[1];
      }
    }

    if (domain === "reddit.com") {
      const match = u.pathname.match(/^\/r\/([^/]+)/);
      if (match) return `r/${match[1]}`;
      const userMatch = u.pathname.match(/^\/(?:user|u)\/([^/]+)/);
      if (userMatch) return `u/${userMatch[1]}`;
    }
  } catch {}

  return null;
}

export interface DomainInfo {
  domain: string;
  count: number;
  favicon: string;
  isSocial: boolean;
  creators: { name: string; count: number; avatar: string | null }[];
}

export function buildDomainIndex(pages: Page[]): DomainInfo[] {
  const domainMap = new Map<string, {
    count: number;
    favicon: string;
    isSocial: boolean;
    creators: Map<string, { count: number; avatar: string | null }>;
  }>();

  for (const page of pages) {
    if (page.deletedAt || page.archived) continue;

    const domain = getDomain(page.url);
    if (!domain) continue;

    let entry = domainMap.get(domain);
    if (!entry) {
      entry = {
        count: 0,
        favicon: page.favicon || "",
        isSocial: isSocialPlatform(domain),
        creators: new Map(),
      };
      domainMap.set(domain, entry);
    }
    entry.count++;
    if (!entry.favicon && page.favicon) entry.favicon = page.favicon;

    if (entry.isSocial) {
      const creator = extractCreator(page);
      if (creator) {
        const existing = entry.creators.get(creator);
        if (existing) {
          existing.count++;
          if (!existing.avatar && page.creatorAvatar) existing.avatar = page.creatorAvatar;
        } else {
          entry.creators.set(creator, { count: 1, avatar: page.creatorAvatar || null });
        }
      }
    }
  }

  return Array.from(domainMap.entries())
    .map(([domain, info]) => ({
      domain,
      count: info.count,
      favicon: info.favicon,
      isSocial: info.isSocial,
      creators: Array.from(info.creators.entries())
        .map(([name, { count, avatar }]) => ({ name, count, avatar }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

export const ONE_OFF_MAX = 2;

export interface TypeGroup {
  type: MediaTypeDef;
  count: number;
  domains: DomainInfo[];
  otherSites?: { count: number; domains: DomainInfo[] };
}

/**
 * Group the domain index by media type. Domains with <= ONE_OFF_MAX pages are
 * collapsed into a per-type `otherSites` bucket so the long tail of one-off
 * domains doesn't bloat the Type view. Empty types are omitted; unknown domains
 * fall back to "other".
 */
export function buildTypeIndex(
  pages: Page[],
  overrides: Record<string, string>,
  customTypes: MediaTypeDef[],
): TypeGroup[] {
  const domainIndex = buildDomainIndex(pages);
  const types = allMediaTypes(customTypes);
  const validIds = new Set(types.map((t) => t.id));

  const byType = new Map<string, DomainInfo[]>();
  for (const info of domainIndex) {
    const id0 = classifyDomain(info.domain, overrides);
    const id = validIds.has(id0) ? id0 : "other";
    const list = byType.get(id) || [];
    list.push(info);
    byType.set(id, list);
  }

  const groups: TypeGroup[] = [];
  for (const type of types) {
    const domains = byType.get(type.id);
    if (!domains || domains.length === 0) continue;
    const primary = domains.filter((d) => d.count > ONE_OFF_MAX);
    const oneOff = domains.filter((d) => d.count <= ONE_OFF_MAX);
    const count = domains.reduce((sum, d) => sum + d.count, 0);
    groups.push({
      type,
      count,
      domains: primary,
      otherSites: oneOff.length
        ? { count: oneOff.reduce((s, d) => s + d.count, 0), domains: oneOff }
        : undefined,
    });
  }
  return groups;
}

export interface FolderInfo {
  name: string;
  count: number;
  groupIds: string[];
}

/**
 * Group the collection's pages by their Group's NAME, folding same-named groups
 * across captures into a single folder entry. Excludes archived groups, blank/empty
 * names, and folders with zero live (non-deleted, non-archived) pages.
 * Sorted by count descending.
 */
export function buildFolderIndex(pages: Page[], groups: Group[]): FolderInfo[] {
  // Build groupId → group name map, skipping archived and blank-named groups
  const groupNameMap = new Map<string, string>();
  for (const g of groups) {
    if (g.archived) continue;
    const trimmed = g.name.trim();
    if (!trimmed) continue;
    groupNameMap.set(g.id, trimmed);
  }

  // Tally live pages by folder name, accumulating contributing groupIds
  const folderMap = new Map<string, { count: number; groupIds: Set<string> }>();
  for (const page of pages) {
    if (page.deletedAt || page.archived) continue;
    const name = groupNameMap.get(page.groupId);
    if (!name) continue;
    let entry = folderMap.get(name);
    if (!entry) {
      entry = { count: 0, groupIds: new Set() };
      folderMap.set(name, entry);
    }
    entry.count++;
    entry.groupIds.add(page.groupId);
  }

  return Array.from(folderMap.entries())
    .map(([name, { count, groupIds }]) => ({
      name,
      count,
      groupIds: Array.from(groupIds),
    }))
    .sort((a, b) => b.count - a.count);
}
