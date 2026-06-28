import { isDuplicate } from "./duplicates";

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
