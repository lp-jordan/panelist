// utils/scriptRepository.ts
import {
  listPages,
  readPage,
  updatePage,
  loadPageContent,
  savePageContent,
  createPage,
  deletePage,
} from './pagesRepository' // <-- change to './pageRepository' if that's your filename

// List pages for a project (returns [{ id, title }])
export async function listScripts(projectId: string) {
  return listPages(projectId)
}

// Read one script by page ID
export async function readScript(id: string, projectId: string) {
  return readPage(id, projectId)
}

// Update a script by page ID
export async function updateScript(
  id: string,
  data: { page_content?: any; metadata?: { title?: string; version?: number } },
  projectId: string,
) {
  return updatePage(id, data, projectId)
}

// Create a new script; returns new page ID
export async function createScript(
  title: string,
  data: { page_content?: any; metadata?: { version?: number } },
  projectId: string,
) {
  return createPage(title, data, projectId)
}

// Load only content + version
export async function loadScriptContent(id: string, projectId: string) {
  return loadPageContent(id, projectId)
}

// Save only content + version
export async function saveScriptContent(
  id: string,
  pageContent: any,
  version: number,
  projectId: string,
) {
  return savePageContent(id, pageContent, version, projectId)
}

// Delete by page ID
export async function deleteScript(id: string, projectId: string) {
  return deletePage(id, projectId)
}
