import { isDuplicate, normalizeUrl } from "./duplicates";

export interface DupTabInfo {
  id?: number;
  url?: string;
  pinned?: boolean;
}

/**
 * Returns the ids of open tabs that are redundant duplicates (same normalized URL).
 * Keeps one tab per URL; never returns pinned tab ids.
 */
export function duplicateTabIdsToClose(tabs: DupTabInfo[]): number[] {
  // Filter to valid http(s) tabs with numeric ids
  const validTabs = tabs.filter(
    (tab): tab is DupTabInfo & { id: number; url: string } =>
      typeof tab.id === "number" &&
      typeof tab.url === "string" &&
      /^https?:\/\//i.test(tab.url),
  );

  // Group by normalized URL
  const groups = new Map<string, (DupTabInfo & { id: number; url: string })[]>();
  for (const tab of validTabs) {
    const key = normalizeUrl(tab.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tab);
  }

  const result: number[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const hasPinned = group.some((t) => t.pinned === true);
    if (hasPinned) {
      // Keep pinned tabs; close all unpinned ones
      for (const tab of group) {
        if (!tab.pinned) result.push(tab.id);
      }
    } else {
      // Keep the first tab; close the rest
      for (let i = 1; i < group.length; i++) {
        result.push(group[i].id);
      }
    }
  }
  return result;
}

export interface OpenTabInfo {
  id?: number;
  url?: string;
  pinned?: boolean;
}

/**
 * Ids of open tabs that are already captured AND safe to close:
 * http(s) URL, not pinned, has a numeric id, URL in capturedUrlSet.
 */
export function closeableCapturedTabIds(
  tabs: OpenTabInfo[],
  capturedUrlSet: Set<string>
): number[] {
  return tabs.reduce<number[]>((acc, tab) => {
    if (
      typeof tab.id === "number" &&
      tab.pinned !== true &&
      typeof tab.url === "string" &&
      /^https?:\/\//i.test(tab.url) &&
      isDuplicate(tab.url, capturedUrlSet)
    ) {
      acc.push(tab.id);
    }
    return acc;
  }, []);
}
