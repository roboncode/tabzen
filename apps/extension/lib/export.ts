import { getAllData, importData } from "./db";
import type { Page, Group, Capture } from "./types";

interface ExportData {
  version: 1;
  exportedAt: string;
  pages: Page[];
  groups: Group[];
  captures: Capture[];
}

export async function exportAsJson(): Promise<string> {
  const data = await getAllData();
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importFromJson(jsonString: string): Promise<{ imported: number; skipped: number }> {
  const data: ExportData = JSON.parse(jsonString);
  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }
  return importData(data);
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
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
