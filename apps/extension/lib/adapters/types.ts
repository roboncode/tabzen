import type { Page, Group, Capture, AITemplate, AIDocument } from "@/lib/types";

export interface DataAdapter {
  // Pages
  addPage(page: Page): Promise<void>;
  addPages(pages: Page[]): Promise<void>;
  getPage(id: string): Promise<Page | undefined>;
  getAllPages(): Promise<Page[]>;
  getPagesByGroup(groupId: string): Promise<Page[]>;
  getPageByUrl(url: string): Promise<Page | undefined>;
  updatePage(id: string, updates: Partial<Page>): Promise<void>;
  softDeletePage(id: string): Promise<void>;
  restorePage(id: string): Promise<void>;
  hardDeletePage(id: string): Promise<void>;
  purgeDeletedPages(olderThanDays: number): Promise<void>;
  searchPages(query: string): Promise<Page[]>;
  getAllTags(): Promise<{ tag: string; count: number }[]>;

  // Groups
  addGroup(group: Group): Promise<void>;
  addGroups(groups: Group[]): Promise<void>;
  getGroup(id: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  getGroupsByCapture(captureId: string): Promise<Group[]>;
  updateGroup(id: string, updates: Partial<Group>): Promise<void>;
  deleteGroup(id: string): Promise<void>;

  // Captures
  addCapture(capture: Capture): Promise<void>;
  getAllCaptures(): Promise<Capture[]>;
  deleteCapture(id: string): Promise<void>;

  // Templates
  getAllTemplates(): Promise<AITemplate[]>;
  getTemplate(id: string): Promise<AITemplate | undefined>;
  putTemplate(template: AITemplate): Promise<void>;
  putTemplates(templates: AITemplate[]): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  // Documents
  getDocumentsForPage(pageId: string): Promise<AIDocument[]>;
  getDocument(pageId: string, templateId: string): Promise<AIDocument | undefined>;
  putDocument(doc: AIDocument): Promise<void>;
  putDocuments(docs: AIDocument[]): Promise<void>;
  deleteDocumentsForPage(pageId: string): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  getAllDocuments(): Promise<AIDocument[]>;

  // Bulk
  getAllData(): Promise<{
    pages: Page[];
    groups: Group[];
    captures: Capture[];
    aiTemplates: AITemplate[];
    aiDocuments: AIDocument[];
  }>;
  importData(data: {
    pages: Page[];
    groups: Group[];
    captures: Capture[];
  }): Promise<{ imported: number; skipped: number }>;
  clearAllData(): Promise<void>;
}
