import { getAllData, importData, putTemplates, putDocuments } from "./db";
import type { Page, Group, Capture, AITemplate, AIDocument } from "./types";

interface ExportData {
  // v1: pages/groups/captures only. v2 also carries AI templates + documents.
  version: 1 | 2;
  exportedAt: string;
  pages: Page[];
  groups: Group[];
  captures: Capture[];
  aiTemplates?: AITemplate[];
  aiDocuments?: AIDocument[];
}

/** Build the full, lossless backup payload (transcripts/content ride along on pages). */
async function buildExportData(): Promise<ExportData> {
  const data = await getAllData();
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    pages: data.pages,
    groups: data.groups,
    captures: data.captures,
    aiTemplates: data.aiTemplates,
    aiDocuments: data.aiDocuments,
  };
}

/** Complete backup as a compact JSON string. */
export async function exportAsJson(): Promise<string> {
  return JSON.stringify(await buildExportData());
}

/**
 * Complete backup as a gzipped blob (.json.gz). Everything we store is text, so
 * gzip shrinks it ~5-10x. Uses the native CompressionStream — no dependency.
 */
export async function exportBackupBlob(): Promise<Blob> {
  const json = await exportAsJson();
  const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(compressed).blob();
}

/** Import from a picked file, auto-detecting gzip (.json.gz) vs plain .json. */
export async function importFromFile(file: File): Promise<{ imported: number; skipped: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  let text: string;
  if (isGzip) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return importFromJson(text);
}

export async function importFromJson(jsonString: string): Promise<{ imported: number; skipped: number }> {
  const data: ExportData = JSON.parse(jsonString);
  if (data.version !== 1 && data.version !== 2) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }
  // Pages (with transcripts/content), groups, captures.
  const result = await importData(data);
  // v2 backups also carry AI templates + saved documents — restore them too.
  if (data.aiTemplates?.length) await putTemplates(data.aiTemplates);
  if (data.aiDocuments?.length) await putDocuments(data.aiDocuments);
  return result;
}

export async function exportAsHtmlBookmarks(): Promise<string> {
  const { pages, groups } = await getAllData();
  const groupMap = new Map<string, Group>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  const pagesByGroup = new Map<string, Page[]>();
  for (const page of pages) {
    const list = pagesByGroup.get(page.groupId) || [];
    list.push(page);
    pagesByGroup.set(page.groupId, list);
  }

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Zen Export</TITLE>
<H1>Tab Zen Export</H1>
<DL><p>\n`;

  for (const [groupId, groupPages] of pagesByGroup) {
    const group = groupMap.get(groupId);
    const name = group?.name || "Ungrouped";
    html += `    <DT><H3>${escapeHtml(name)}</H3>\n`;
    html += `    <DL><p>\n`;
    for (const page of groupPages) {
      html += `        <DT><A HREF="${escapeHtml(page.url)}">${escapeHtml(page.title)}</A>\n`;
    }
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
