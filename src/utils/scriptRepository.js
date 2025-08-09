import {
  listPages,
  readPage,
  updatePage,
  loadPageContent,
  savePageContent,
  createPage,
  deletePage,
} from './pageRepository'

export async function listScripts(projectId) {
  return listPages(projectId)
}

export async function readScript(id, projectId) {
  return readPage(id, projectId)
}

export async function updateScript(id, data, projectId) {
  return updatePage(id, data, projectId)
}

export async function createScript(name, data, projectId) {
  return createPage(name, data, projectId)
}

export async function loadScriptContent(id, projectId) {
  return loadPageContent(id, projectId)
}

export async function saveScriptContent(id, pageContent, version, projectId) {
  return savePageContent(id, pageContent, version, projectId)
}

export async function deleteScript(id, projectId) {
  return deletePage(id, projectId)
}
