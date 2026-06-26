import type { CapturePreviewData } from "./types";
import { classifyMediaType } from "./media-types";

/** Distinct type ids present among a preview's pages. */
export function presentTypeIds(
  preview: CapturePreviewData,
  overrides: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  for (const p of preview.pages) seen.add(classifyMediaType(p.url, overrides));
  return [...seen];
}

/** Trim a preview to pages whose type is selected; drop emptied groups. */
export function filterPreviewByTypes(
  preview: CapturePreviewData,
  selectedTypeIds: string[],
  overrides: Record<string, string>,
): CapturePreviewData {
  const pages = preview.pages.filter((p) =>
    selectedTypeIds.includes(classifyMediaType(p.url, overrides)),
  );
  const keep = new Set(pages.map((p) => p.id));
  const groups = preview.groups
    .map((g) => ({
      groupName: g.groupName,
      pageIds: g.pageIds.filter((id) => keep.has(id)),
    }))
    .filter((g) => g.pageIds.length > 0);
  return { ...preview, pages, groups };
}
