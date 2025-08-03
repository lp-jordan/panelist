import { listPages, readPage, updatePage } from './pageRepository'

export async function listScripts(projectId) {
  return listPages(projectId)
}

export async function readScript(name, projectId) {
  return readPage(name, projectId)
}

export async function updateScript(name, data, projectId) {
  return updatePage(name, data, projectId)
}
