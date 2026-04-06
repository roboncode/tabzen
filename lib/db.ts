import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Tab, Group, Capture } from "./types";

interface TabZenDB extends DBSchema {
  tabs: {
    key: string;
    value: Tab;
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
}

let dbInstance: IDBPDatabase<TabZenDB> | null = null;

async function getDB(): Promise<IDBPDatabase<TabZenDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TabZenDB>("tab-zen", 1, {
    upgrade(db) {
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
    },
  });
  return dbInstance;
}

export async function addTab(tab: Tab): Promise<void> {
  const db = await getDB();
  await db.put("tabs", tab);
}

export async function addTabs(tabs: Tab[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("tabs", "readwrite");
  for (const tab of tabs) {
    tx.store.put(tab);
  }
  await tx.done;
}

export async function getTab(id: string): Promise<Tab | undefined> {
  const db = await getDB();
  return db.get("tabs", id);
}

export async function getAllTabs(): Promise<Tab[]> {
  const db = await getDB();
  return db.getAll("tabs");
}

export async function getTabsByGroup(groupId: string): Promise<Tab[]> {
  const db = await getDB();
  return db.getAllFromIndex("tabs", "by-groupId", groupId);
}

export async function getTabByUrl(url: string): Promise<Tab | undefined> {
  const db = await getDB();
  const tabs = await db.getAllFromIndex("tabs", "by-url", url);
  return tabs[0];
}

export async function updateTab(id: string, updates: Partial<Tab>): Promise<void> {
  const db = await getDB();
  const tab = await db.get("tabs", id);
  if (tab) {
    await db.put("tabs", { ...tab, ...updates });
  }
}

export async function hardDeleteTab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("tabs", id);
}

export async function softDeleteTab(id: string): Promise<void> {
  const db = await getDB();
  const tab = await db.get("tabs", id);
  if (tab) {
    await db.put("tabs", { ...tab, deletedAt: new Date().toISOString() });
  }
}

export async function restoreTab(id: string): Promise<void> {
  const db = await getDB();
  const tab = await db.get("tabs", id);
  if (tab) {
    await db.put("tabs", { ...tab, deletedAt: null });
  }
}

export async function purgeDeletedTabs(olderThanDays: number): Promise<void> {
  const db = await getDB();
  const all = await db.getAll("tabs");
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const toDelete = all.filter((t) => t.deletedAt && t.deletedAt < cutoff);
  const tx = db.transaction("tabs", "readwrite");
  for (const tab of toDelete) {
    tx.store.delete(tab.id);
  }
  await tx.done;
}

export async function searchTabs(query: string): Promise<Tab[]> {
  const db = await getDB();
  const all = await db.getAll("tabs");
  const lower = query.toLowerCase();
  return all.filter(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.url.toLowerCase().includes(lower) ||
      t.ogDescription?.toLowerCase().includes(lower) ||
      t.ogTitle?.toLowerCase().includes(lower) ||
      t.metaDescription?.toLowerCase().includes(lower) ||
      t.notes?.toLowerCase().includes(lower),
  );
}

export async function addGroup(group: Group): Promise<void> {
  const db = await getDB();
  await db.put("groups", group);
}

export async function addGroups(groups: Group[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("groups", "readwrite");
  for (const group of groups) {
    tx.store.put(group);
  }
  await tx.done;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const db = await getDB();
  return db.get("groups", id);
}

export async function getAllGroups(): Promise<Group[]> {
  const db = await getDB();
  return db.getAll("groups");
}

export async function getGroupsByCapture(captureId: string): Promise<Group[]> {
  const db = await getDB();
  return db.getAllFromIndex("groups", "by-captureId", captureId);
}

export async function updateGroup(id: string, updates: Partial<Group>): Promise<void> {
  const db = await getDB();
  const group = await db.get("groups", id);
  if (group) {
    await db.put("groups", { ...group, ...updates });
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("groups", id);
}

export async function addCapture(capture: Capture): Promise<void> {
  const db = await getDB();
  await db.put("captures", capture);
}

export async function getAllCaptures(): Promise<Capture[]> {
  const db = await getDB();
  return db.getAll("captures");
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("captures", id);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["tabs", "groups", "captures"], "readwrite");
  await tx.objectStore("tabs").clear();
  await tx.objectStore("groups").clear();
  await tx.objectStore("captures").clear();
  await tx.done;
}

export async function getAllData(): Promise<{ tabs: Tab[]; groups: Group[]; captures: Capture[] }> {
  const db = await getDB();
  const [tabs, groups, captures] = await Promise.all([
    db.getAll("tabs"),
    db.getAll("groups"),
    db.getAll("captures"),
  ]);
  return { tabs, groups, captures };
}

export async function importData(data: { tabs: Tab[]; groups: Group[]; captures: Capture[] }): Promise<{ imported: number; skipped: number }> {
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

  for (const tab of data.tabs) {
    const existingByUrl = await tx.objectStore("tabs").index("by-url").get(tab.url);
    if (existingByUrl) {
      skipped++;
    } else {
      await tx.objectStore("tabs").put(tab);
      imported++;
    }
  }

  await tx.done;
  return { imported, skipped };
}
