// utils/scriptRepository.js
import {
  listPages,
  readPage,
  updatePage,
  loadPageContent,
  savePageContent,
  createPage,
  deletePage,
} from './pageRepository' // keep this path matching your filename

// List pages for a project (returns [{ id, title }])
export async function listScripts(projectId) {
  return listPages(projectId)
}

// Read one script by page ID
export async function readScript(id, projectId) {
  return readPage(id, projectId)
}

// Update a script by page ID
export async function updateScript(id, data, projectId) {
  return updatePage(id, data, projectId)
}

// Create a new script; returns new page ID
export async function createScript(title, data, projectId) {
  return createPage(title, data, projectId)
}

// Load only content + version
export async function loadScriptContent(id, projectId) {
  return loadPageContent(id, projectId)
}

// Save only content + version
export async function saveScriptContent(id, pageContent, version, projectId) {
  return savePageContent(id, pageContent, version, projectId)
}

// Delete by page ID
export async function deleteScript(id, projectId) {
  return deletePage(id, projectId)
}
