import type { DataAdapter } from "./types";
import * as db from "@/lib/db";

export const indexeddbAdapter: DataAdapter = {
  // Pages
  addPage: db.addPage,
  addPages: db.addPages,
  getPage: db.getPage,
  getAllPages: db.getAllPages,
  getPagesByGroup: db.getPagesByGroup,
  getPageByUrl: db.getPageByUrl,
  updatePage: db.updatePage,
  softDeletePage: db.softDeletePage,
  restorePage: db.restorePage,
  hardDeletePage: db.hardDeletePage,
  purgeDeletedPages: db.purgeDeletedPages,
  searchPages: db.searchPages,
  getAllTags: db.getAllTags,

  // Groups
  addGroup: db.addGroup,
  addGroups: db.addGroups,
  getGroup: db.getGroup,
  getAllGroups: db.getAllGroups,
  getGroupsByCapture: db.getGroupsByCapture,
  updateGroup: db.updateGroup,
  deleteGroup: db.deleteGroup,

  // Captures
  addCapture: db.addCapture,
  getAllCaptures: db.getAllCaptures,
  deleteCapture: db.deleteCapture,

  // Templates
  getAllTemplates: db.getAllTemplates,
  getTemplate: db.getTemplate,
  putTemplate: db.putTemplate,
  putTemplates: db.putTemplates,
  deleteTemplate: db.deleteTemplate,

  // Documents
  getDocumentsForPage: db.getDocumentsForPage,
  getDocument: db.getDocument,
  putDocument: db.putDocument,
  putDocuments: db.putDocuments,
  deleteDocumentsForPage: db.deleteDocumentsForPage,
  deleteDocument: db.deleteDocument,
  getAllDocuments: db.getAllDocuments,

  // Bulk
  getAllData: db.getAllData,
  importData: db.importData,
  clearAllData: db.clearAllData,
};
