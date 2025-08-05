import {
  listPages,
  readPage,
  updatePage,
  loadPageContent,
  savePageContent,
  createPage,
} from './pageRepository'

export async function listScripts(projectId) {
  return listPages(projectId)
}

export async function readScript(name, projectId) {
  return readPage(name, projectId)
}

export async function updateScript(name, data, projectId) {
  return updatePage(name, data, projectId)
}

export async function createScript(name, data, projectId) {
  return createPage(name, data, projectId)
}

export async function loadScriptContent(name, projectId) {
  return loadPageContent(name, projectId)
}

export async function saveScriptContent(name, pageContent, version, projectId) {
  return savePageContent(name, pageContent, version, projectId)
}
