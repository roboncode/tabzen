import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Page, Group, Capture, AITemplate, AIDocument } from "./types";
import { isServiceActive } from "./adapter-state";
import { serviceAdapter } from "./adapters/service-adapter";

interface TabZenDB extends DBSchema {
  tabs: {
    key: string;
    value: Page;
    indexes: {
      "by-url": string;
      "by-groupId": string;
      "by-capturedAt": string;
      "by-archived": number;
    };
  };
  groups: {
    key: string;
    value: Group;
    indexes: {
      "by-captureId": string;
      "by-position": number;
    };
  };
  captures: {
    key: string;
    value: Capture;
    indexes: {
      "by-capturedAt": string;
    };
  };
  aiTemplates: {
    key: string;
    value: AITemplate;
    indexes: {
      "by-sortOrder": number;
    };
  };
  aiDocuments: {
    key: string;
    value: AIDocument;
    indexes: {
      "by-pageId": string;
      "by-templateId": string;
    };
  };
}

let dbInstance: IDBPDatabase<TabZenDB> | null = null;

async function getDB(): Promise<IDBPDatabase<TabZenDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TabZenDB>("tab-zen", 3, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const tabStore = db.createObjectStore("tabs", { keyPath: "id" });
        tabStore.createIndex("by-url", "url");
        tabStore.createIndex("by-groupId", "groupId");
        tabStore.createIndex("by-capturedAt", "capturedAt");
        tabStore.createIndex("by-archived", "archived");

        const groupStore = db.createObjectStore("groups", { keyPath: "id" });
        groupStore.createIndex("by-captureId", "captureId");
        groupStore.createIndex("by-position", "position");

        const captureStore = db.createObjectStore("captures", { keyPath: "id" });
        captureStore.createIndex("by-capturedAt", "capturedAt");
      }

      if (oldVersion < 2) {
        const templateStore = db.createObjectStore("aiTemplates", { keyPath: "id" });
        templateStore.createIndex("by-sortOrder", "sortOrder");

        const docStore = db.createObjectStore("aiDocuments", { keyPath: "id" });
        // v2 creates with old field name; v3 migration below renames the index
        (docStore as any).createIndex("by-tabId", "tabId");
        docStore.createIndex("by-templateId", "templateId");
      }

      if (oldVersion < 3) {
        const docStore = tx.objectStore("aiDocuments");
        // Delete old index and create new one for renamed field
        if ((docStore as any).indexNames.contains("by-tabId")) {
          (docStore as any).deleteIndex("by-tabId");
        }
        docStore.createIndex("by-pageId", "pageId");
      }
    },
  });

  // Migrate existing AIDocument records: rename tabId → pageId (post-upgrade)
  await migrateDocumentPageIds(dbInstance);

  return dbInstance;
}

/** Rename tabId → pageId on any AIDocument records left from before the v3 schema change. */
async function migrateDocumentPageIds(db: IDBPDatabase<TabZenDB>): Promise<void> {
  const tx = db.transaction("aiDocuments", "readwrite");
  const store = tx.store;
  let cursor = await store.openCursor();
  while (cursor) {
    const record = cursor.value as any;
    if (record.tabId && !record.pageId) {
      record.pageId = record.tabId;
      delete record.tabId;
      await cursor.update(record as AIDocument);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function addPage(page: Page): Promise<void> {
  if (isServiceActive()) return serviceAdapter.addPage(page);
  const db = await getDB();
  await db.put("tabs", page);
}

export async function addPages(pages: Page[]): Promise<void> {
  if (isServiceActive()) return serviceAdapter.addPages(pages);
  const db = await getDB();
  const tx = db.transaction("tabs", "readwrite");
  for (const page of pages) {
    tx.store.put(page);
  }
  await tx.done;
}

export async function getPage(id: string): Promise<Page | undefined> {
  if (isServiceActive()) return serviceAdapter.getPage(id);
  const db = await getDB();
  return db.get("tabs", id);
}

export async function getAllPages(): Promise<Page[]> {
  if (isServiceActive()) return serviceAdapter.getAllPages();
  const db = await getDB();
  return db.getAll("tabs");
}

export async function getPagesByGroup(groupId: string): Promise<Page[]> {
  if (isServiceActive()) return serviceAdapter.getPagesByGroup(groupId);
  const db = await getDB();
  return db.getAllFromIndex("tabs", "by-groupId", groupId);
}

export async function getPageByUrl(url: string): Promise<Page | undefined> {
  if (isServiceActive()) return serviceAdapter.getPageByUrl(url);
  const db = await getDB();
  const pages = await db.getAllFromIndex("tabs", "by-url", url);
  return pages[0];
}

export async function updatePage(id: string, updates: Partial<Page>): Promise<void> {
  if (isServiceActive()) return serviceAdapter.updatePage(id, updates);
  const db = await getDB();
  const page = await db.get("tabs", id);
  if (page) {
    await db.put("tabs", { ...page, ...updates });
  }
}

export async function hardDeletePage(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.hardDeletePage(id);
  const db = await getDB();
  await db.delete("tabs", id);
}

export async function softDeletePage(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.softDeletePage(id);
  const db = await getDB();
  const page = await db.get("tabs", id);
  if (page) {
    await db.put("tabs", { ...page, deletedAt: new Date().toISOString() });
  }
}

export async function restorePage(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.restorePage(id);
  const db = await getDB();
  const page = await db.get("tabs", id);
  if (page) {
    await db.put("tabs", { ...page, deletedAt: null });
  }
}

export async function purgeDeletedPages(olderThanDays: number): Promise<void> {
  if (isServiceActive()) return serviceAdapter.purgeDeletedPages(olderThanDays);
  const db = await getDB();
  const all = await db.getAll("tabs");
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const toDelete = all.filter((t) => t.deletedAt && t.deletedAt < cutoff);
  const tx = db.transaction("tabs", "readwrite");
  for (const page of toDelete) {
    tx.store.delete(page.id);
  }
  await tx.done;
}

export async function searchPages(query: string): Promise<Page[]> {
  if (isServiceActive()) return serviceAdapter.searchPages(query);
  const db = await getDB();
  const all = await db.getAll("tabs");
  const lower = query.toLowerCase();

  // Handle #tag search
  if (lower.startsWith("#")) {
    const tag = lower.slice(1).trim();
    if (!tag) return all;
    return all.filter((page) =>
      page.tags?.some((tg) => tg.toLowerCase().includes(tag)),
    );
  }

  return all.filter(
    (page) =>
      page.title.toLowerCase().includes(lower) ||
      page.url.toLowerCase().includes(lower) ||
      page.ogDescription?.toLowerCase().includes(lower) ||
      page.ogTitle?.toLowerCase().includes(lower) ||
      page.metaDescription?.toLowerCase().includes(lower) ||
      page.notes?.toLowerCase().includes(lower) ||
      page.tags?.some((tg) => tg.toLowerCase().includes(lower)),
  );
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  if (isServiceActive()) return serviceAdapter.getAllTags();
  const db = await getDB();
  const all = await db.getAll("tabs");
  const tagCounts = new Map<string, number>();
  for (const page of all) {
    if (page.deletedAt || !page.tags) continue;
    for (const tag of page.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export async function addGroup(group: Group): Promise<void> {
  if (isServiceActive()) return serviceAdapter.addGroup(group);
  const db = await getDB();
  await db.put("groups", group);
}

export async function addGroups(groups: Group[]): Promise<void> {
  if (isServiceActive()) return serviceAdapter.addGroups(groups);
  const db = await getDB();
  const tx = db.transaction("groups", "readwrite");
  for (const group of groups) {
    tx.store.put(group);
  }
  await tx.done;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  if (isServiceActive()) return serviceAdapter.getGroup(id);
  const db = await getDB();
  return db.get("groups", id);
}

export async function getAllGroups(): Promise<Group[]> {
  if (isServiceActive()) return serviceAdapter.getAllGroups();
  const db = await getDB();
  return db.getAll("groups");
}

export async function getGroupsByCapture(captureId: string): Promise<Group[]> {
  if (isServiceActive()) return serviceAdapter.getGroupsByCapture(captureId);
  const db = await getDB();
  return db.getAllFromIndex("groups", "by-captureId", captureId);
}

export async function updateGroup(id: string, updates: Partial<Group>): Promise<void> {
  if (isServiceActive()) return serviceAdapter.updateGroup(id, updates);
  const db = await getDB();
  const group = await db.get("groups", id);
  if (group) {
    await db.put("groups", { ...group, ...updates });
  }
}

export async function deleteGroup(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.deleteGroup(id);
  const db = await getDB();
  await db.delete("groups", id);
}

export async function addCapture(capture: Capture): Promise<void> {
  if (isServiceActive()) return serviceAdapter.addCapture(capture);
  const db = await getDB();
  await db.put("captures", capture);
}

export async function getAllCaptures(): Promise<Capture[]> {
  if (isServiceActive()) return serviceAdapter.getAllCaptures();
  const db = await getDB();
  return db.getAll("captures");
}

export async function deleteCapture(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.deleteCapture(id);
  const db = await getDB();
  await db.delete("captures", id);
}

export async function clearProfileData(deviceId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["tabs", "groups", "captures"], "readwrite");

  // Delete pages belonging to this device
  const allPages = await tx.objectStore("tabs").getAll();
  const groupIds = new Set<string>();
  const captureIds = new Set<string>();
  for (const page of allPages) {
    if (page.deviceId === deviceId) {
      groupIds.add(page.groupId);
      await tx.objectStore("tabs").delete(page.id);
    }
  }

  // Delete groups that only had pages from this device
  const remainingPages = await tx.objectStore("tabs").getAll();
  const usedGroupIds = new Set(remainingPages.map((p) => p.groupId));
  const allGroups = await tx.objectStore("groups").getAll();
  for (const group of allGroups) {
    if (groupIds.has(group.id) && !usedGroupIds.has(group.id)) {
      captureIds.add(group.captureId);
      await tx.objectStore("groups").delete(group.id);
    }
  }

  // Delete captures that have no remaining groups
  const remainingGroups = await tx.objectStore("groups").getAll();
  const usedCaptureIds = new Set(remainingGroups.map((g) => g.captureId));
  for (const captureId of captureIds) {
    if (!usedCaptureIds.has(captureId)) {
      await tx.objectStore("captures").delete(captureId);
    }
  }

  await tx.done;
}

export async function clearAllData(): Promise<void> {
  if (isServiceActive()) return serviceAdapter.clearAllData();
  const db = await getDB();
  const tx = db.transaction(["tabs", "groups", "captures", "aiTemplates", "aiDocuments"], "readwrite");
  await tx.objectStore("tabs").clear();
  await tx.objectStore("groups").clear();
  await tx.objectStore("captures").clear();
  await tx.objectStore("aiTemplates").clear();
  await tx.objectStore("aiDocuments").clear();
  await tx.done;
}

export async function getAllData(): Promise<{
  pages: Page[];
  groups: Group[];
  captures: Capture[];
  aiTemplates: AITemplate[];
  aiDocuments: AIDocument[];
}> {
  if (isServiceActive()) return serviceAdapter.getAllData();
  const db = await getDB();
  const [pages, groups, captures, aiTemplates, aiDocuments] = await Promise.all([
    db.getAll("tabs"),
    db.getAll("groups"),
    db.getAll("captures"),
    db.getAll("aiTemplates"),
    db.getAll("aiDocuments"),
  ]);
  return { pages, groups, captures, aiTemplates, aiDocuments };
}

export async function importData(data: { pages: Page[]; groups: Group[]; captures: Capture[] }): Promise<{ imported: number; skipped: number }> {
  if (isServiceActive()) return serviceAdapter.importData(data);
  const db = await getDB();
  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(["tabs", "groups", "captures"], "readwrite");

  for (const capture of data.captures) {
    const existing = await tx.objectStore("captures").get(capture.id);
    if (!existing) {
      await tx.objectStore("captures").put(capture);
    }
  }

  for (const group of data.groups) {
    const existing = await tx.objectStore("groups").get(group.id);
    if (!existing) {
      await tx.objectStore("groups").put(group);
    }
  }

  for (const page of data.pages) {
    const existingByUrl = await tx.objectStore("tabs").index("by-url").get(page.url);
    if (existingByUrl) {
      skipped++;
    } else {
      await tx.objectStore("tabs").put(page);
      imported++;
    }
  }

  await tx.done;
  return { imported, skipped };
}

// --- AI Templates ---

export async function getAllTemplates(): Promise<AITemplate[]> {
  if (isServiceActive()) return serviceAdapter.getAllTemplates();
  const db = await getDB();
  const all = await db.getAll("aiTemplates");
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTemplate(id: string): Promise<AITemplate | undefined> {
  if (isServiceActive()) return serviceAdapter.getTemplate(id);
  const db = await getDB();
  return db.get("aiTemplates", id);
}

export async function putTemplate(template: AITemplate): Promise<void> {
  if (isServiceActive()) return serviceAdapter.putTemplate(template);
  const db = await getDB();
  await db.put("aiTemplates", template);
}

export async function putTemplates(templates: AITemplate[]): Promise<void> {
  if (isServiceActive()) return serviceAdapter.putTemplates(templates);
  const db = await getDB();
  const tx = db.transaction("aiTemplates", "readwrite");
  for (const t of templates) {
    tx.store.put(t);
  }
  await tx.done;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.deleteTemplate(id);
  const db = await getDB();
  await db.delete("aiTemplates", id);
}

// --- AI Documents ---

export async function getDocumentsForPage(pageId: string): Promise<AIDocument[]> {
  if (isServiceActive()) return serviceAdapter.getDocumentsForPage(pageId);
  const db = await getDB();
  return db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
}

export async function getDocument(pageId: string, templateId: string): Promise<AIDocument | undefined> {
  if (isServiceActive()) return serviceAdapter.getDocument(pageId, templateId);
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
  return docs.find((d) => d.templateId === templateId);
}

export async function putDocument(doc: AIDocument): Promise<void> {
  if (isServiceActive()) return serviceAdapter.putDocument(doc);
  const db = await getDB();
  const existing = await getDocument(doc.pageId, doc.templateId);
  if (existing) {
    await db.delete("aiDocuments", existing.id);
  }
  await db.put("aiDocuments", doc);
}

export async function deleteDocumentsForPage(pageId: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.deleteDocumentsForPage(pageId);
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
  const tx = db.transaction("aiDocuments", "readwrite");
  for (const doc of docs) {
    tx.store.delete(doc.id);
  }
  await tx.done;
}

export async function deleteDocument(id: string): Promise<void> {
  if (isServiceActive()) return serviceAdapter.deleteDocument(id);
  const db = await getDB();
  await db.delete("aiDocuments", id);
}

export async function getAllDocuments(): Promise<AIDocument[]> {
  if (isServiceActive()) return serviceAdapter.getAllDocuments();
  const db = await getDB();
  return db.getAll("aiDocuments");
}

export async function putDocuments(docs: AIDocument[]): Promise<void> {
  if (isServiceActive()) return serviceAdapter.putDocuments(docs);
  const db = await getDB();
  const tx = db.transaction("aiDocuments", "readwrite");
  for (const doc of docs) {
    tx.store.put(doc);
  }
  await tx.done;
}
