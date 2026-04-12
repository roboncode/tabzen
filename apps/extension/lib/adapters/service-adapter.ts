import type { Page, Group, Capture, AITemplate, AIDocument } from "@/lib/types";
import type { DataAdapter } from "./types";

const BASE_URL = "http://localhost:7824/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Service request failed: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

async function requestMaybe<T>(path: string): Promise<T | undefined> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`Service request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export const serviceAdapter: DataAdapter = {
  // --- Pages ---

  async addPage(page: Page): Promise<void> {
    await post("/pages", page);
  },

  async addPages(pages: Page[]): Promise<void> {
    await post("/pages", pages);
  },

  async getPage(id: string): Promise<Page | undefined> {
    return requestMaybe<Page>(`/pages/${encodeURIComponent(id)}`);
  },

  async getAllPages(): Promise<Page[]> {
    return request<Page[]>("/pages");
  },

  async getPagesByGroup(groupId: string): Promise<Page[]> {
    return request<Page[]>(`/pages?groupId=${encodeURIComponent(groupId)}`);
  },

  async getPageByUrl(url: string): Promise<Page | undefined> {
    const pages = await request<Page[]>(
      `/pages?url=${encodeURIComponent(url)}&limit=1`,
    );
    return pages[0];
  },

  async updatePage(id: string, updates: Partial<Page>): Promise<void> {
    await put(`/pages/${encodeURIComponent(id)}`, updates);
  },

  async softDeletePage(id: string): Promise<void> {
    await del(`/pages/${encodeURIComponent(id)}`);
  },

  async restorePage(id: string): Promise<void> {
    await put(`/pages/${encodeURIComponent(id)}`, { deletedAt: null });
  },

  async hardDeletePage(id: string): Promise<void> {
    // Phase 1: soft delete (same as softDeletePage)
    await del(`/pages/${encodeURIComponent(id)}`);
  },

  async purgeDeletedPages(_olderThanDays: number): Promise<void> {
    // Phase 1: no-op, server handles purge policy
  },

  async searchPages(query: string): Promise<Page[]> {
    return request<Page[]>(`/pages?search=${encodeURIComponent(query)}`);
  },

  async getAllTags(): Promise<{ tag: string; count: number }[]> {
    const pages = await request<Page[]>("/pages");
    const tagCounts = new Map<string, number>();
    for (const page of pages) {
      if (page.deletedAt || !page.tags) continue;
      for (const tag of page.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },

  // --- Groups ---

  async addGroup(group: Group): Promise<void> {
    await post("/groups", group);
  },

  async addGroups(groups: Group[]): Promise<void> {
    await post("/batch", { groups, pages: [], captures: [], templates: [], documents: [] });
  },

  async getGroup(id: string): Promise<Group | undefined> {
    return requestMaybe<Group>(`/groups/${encodeURIComponent(id)}`);
  },

  async getAllGroups(): Promise<Group[]> {
    return request<Group[]>("/groups");
  },

  async getGroupsByCapture(captureId: string): Promise<Group[]> {
    const groups = await request<Group[]>("/groups");
    return groups.filter((g) => g.captureId === captureId);
  },

  async updateGroup(id: string, updates: Partial<Group>): Promise<void> {
    await put(`/groups/${encodeURIComponent(id)}`, updates);
  },

  async deleteGroup(id: string): Promise<void> {
    await del(`/groups/${encodeURIComponent(id)}`);
  },

  // --- Captures ---

  async addCapture(capture: Capture): Promise<void> {
    await post("/captures", capture);
  },

  async getAllCaptures(): Promise<Capture[]> {
    return request<Capture[]>("/captures");
  },

  async deleteCapture(id: string): Promise<void> {
    await del(`/captures/${encodeURIComponent(id)}`);
  },

  // --- Templates ---

  async getAllTemplates(): Promise<AITemplate[]> {
    return request<AITemplate[]>("/templates");
  },

  async getTemplate(id: string): Promise<AITemplate | undefined> {
    return requestMaybe<AITemplate>(`/templates/${encodeURIComponent(id)}`);
  },

  async putTemplate(template: AITemplate): Promise<void> {
    await put(`/templates/${encodeURIComponent(template.id)}`, template);
  },

  async putTemplates(templates: AITemplate[]): Promise<void> {
    await post("/batch", { templates, pages: [], groups: [], captures: [], documents: [] });
  },

  async deleteTemplate(id: string): Promise<void> {
    await del(`/templates/${encodeURIComponent(id)}`);
  },

  // --- Documents ---

  async getDocumentsForPage(pageId: string): Promise<AIDocument[]> {
    return request<AIDocument[]>(`/documents?pageId=${encodeURIComponent(pageId)}`);
  },

  async getDocument(pageId: string, templateId: string): Promise<AIDocument | undefined> {
    const docs = await request<AIDocument[]>(
      `/documents?pageId=${encodeURIComponent(pageId)}`,
    );
    return docs.find((d) => d.templateId === templateId);
  },

  async putDocument(doc: AIDocument): Promise<void> {
    await put(`/documents/${encodeURIComponent(doc.id)}`, doc);
  },

  async putDocuments(docs: AIDocument[]): Promise<void> {
    await post("/batch", { documents: docs, pages: [], groups: [], captures: [], templates: [] });
  },

  async deleteDocumentsForPage(pageId: string): Promise<void> {
    const docs = await request<AIDocument[]>(
      `/documents?pageId=${encodeURIComponent(pageId)}`,
    );
    await Promise.all(docs.map((d) => del(`/documents/${encodeURIComponent(d.id)}`)));
  },

  async deleteDocument(id: string): Promise<void> {
    await del(`/documents/${encodeURIComponent(id)}`);
  },

  async getAllDocuments(): Promise<AIDocument[]> {
    return request<AIDocument[]>("/documents");
  },

  // --- Bulk ---

  async getAllData() {
    const [pages, groups, captures, aiTemplates, aiDocuments] = await Promise.all([
      request<Page[]>("/pages"),
      request<Group[]>("/groups"),
      request<Capture[]>("/captures"),
      request<AITemplate[]>("/templates"),
      request<AIDocument[]>("/documents"),
    ]);
    return { pages, groups, captures, aiTemplates, aiDocuments };
  },

  async importData(data) {
    const resp = await post<{ pages: number; groups: number; captures: number; templates: number; documents: number }>("/batch", data);
    const imported = (resp.pages || 0) + (resp.groups || 0) + (resp.captures || 0) + (resp.templates || 0) + (resp.documents || 0);
    return { imported, skipped: 0 };
  },

  async clearAllData(): Promise<void> {
    // Phase 1: no-op, requires server-side implementation
  },
};
